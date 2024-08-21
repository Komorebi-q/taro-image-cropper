import { Canvas, Image, View } from "@tarojs/components";
import { useImmer } from "use-immer";
import "./index.scss";
import { useState } from "react";
import { useEffect } from "react";
import Taro from "@tarojs/taro";
import { useThrottle } from "use-throttle";
import { useRef } from "react";
import { forwardRef } from "react";

const ImageCropper = forwardRef(function _ImageCropper(
  {
    src = "http://10.5.1.158:8899/static/example.jpg",
    cropRatio,
    disableRotate,
    disabledScale,
    quality = 1,
  },
  ref,
) {
  const [s, setS] = useImmer({
    scale: 1,
    rotate: 0,
    width: 0,
    height: 0,
    previewImage: null,
  });
  const [image, setImage] = useImmer({
    imageSrc: null,
    imageInfo: null,
    width: 0,
    height: 0,
    translateX: 0,
    translateY: 0,
    originalWidth: 0,
    originalHeight: 0,
    originalTranslateX: 0,
    originalTranslateY: 0,
  });
  const [clip, setClip] = useImmer({
    scaling: false,
    prev: null,
    scaleStyle: null,
    width: 0,
    height: 0,
    translateX: 0,
    translateY: 0,
  });
  const [gesture, setGesture] = useImmer({});
  const commitClipTimerRef = useRef(null);

  useEffect(() => {
    onMount();
  }, []);

  async function onMount() {
    const [containerRect, imageRes] = await Promise.all([
      new Promise((resolve, reject) => {
        Taro.createSelectorQuery()
          .select(".cropper")
          .boundingClientRect()
          .exec((res) => {
            resolve(res[0]);
          });
      }),
      new Promise((resolve, reject) => {
        Taro.downloadFile({
          url: src,
          success: (res) => {
            Taro.getImageInfo({
              src: res.tempFilePath,
              success: (info) => {
                resolve(info);
              },
            });
          },
        });
      }),
    ]);
    const { width, height } = containerRect;
    const {
      height: imageHeight,
      orientation: imageOrientation,
      path: imageSrc,
      type: imageType,
      width: imageWidth,
    } = imageRes;
    const imageRatio = imageWidth / imageHeight;
    const mainDir = imageWidth > imageHeight ? "width" : "height";
    let clipWidth = Infinity,
      clipHeight = Infinity,
      clipTranslateX,
      clipTranslateY;
    let clipScaleRate = 0.8;
    while (clipWidth > width * 0.8 || clipHeight > height * 0.8) {
      clipWidth = width * 0.8;
      clipHeight = clipWidth / imageRatio;
      clipScaleRate -= 0.5;
    }
    clipTranslateX = (width - clipWidth) / 2;
    clipTranslateY = (height - clipHeight) / 2;
    setS((s) => {
      s.width = width;
      s.height = height;
    });
    setClip((s) => {
      s.width = clipWidth;
      s.height = clipHeight;
      s.translateX = clipTranslateX;
      s.translateY = clipTranslateY;
    });
    setImage((s) => {
      s.imageSrc = imageSrc;
      s.imageInfo = imageRes;
      s.width = clipWidth;
      s.height = clipHeight;
      s.translateX = clipTranslateX;
      s.translateY = clipTranslateY;
      s.originalWidth = clipWidth;
      s.originalHeight = clipHeight;
      s.originalTranslateX = clipTranslateX;
      s.originalTranslateY = clipTranslateY;
    });
  }

  const commitClip = async () => {
    const { width, height } = s;

    setClip((s) => {
      s.committing = true;
    });
    const {
      width: clipWidth,
      height: clipHeight,
      translateX: clipTranslateX,
      translateY: clipTranslateY,
    } = clip;
    const {
      translateX: imageTranslateX,
      translateY: imageTranslateY,
      width: imageWidth,
      height: imageHeight,
      originalTranslateX: imageOriginalTranslateX,
      originalTranslateY: imageOriginalTranslateY,
      originalWidth: imageOriginalWidth,
      originalHeight: imageOriginalHeight,
    } = image;
    const dirMain = clipWidth > clipHeight ? "width" : "height";
    const clipRatio = clipWidth / clipHeight;
    let newClipWidth = Infinity,
      newClipHeight = Infinity,
      newClipTranslateX,
      newClipTranslateY;
    let imageScale = 1;
    let clipScaleRate = 0.8;
    while (newClipWidth > width * 0.8 || newClipHeight > height * 0.8) {
      newClipWidth = width * 0.8;
      imageScale = newClipWidth / clipWidth;
      newClipHeight = newClipWidth / clipRatio;
      clipScaleRate -= 0.5;
    }

    newClipTranslateX = (width - newClipWidth) / 2;
    newClipTranslateY = (height - newClipHeight) / 2;
    const diffTranslateX = newClipTranslateX - clipTranslateX;
    const diffTranslateY = newClipTranslateY - clipTranslateY;

    const newImageWidth = imageWidth * imageScale;
    const newImageHeight = imageHeight * imageScale;
    const relativeTranslateX = clipTranslateX - imageTranslateX;
    const relativeTranslateY = clipTranslateY - imageTranslateY;
    const newImageTranslateX =
      imageTranslateX + relativeTranslateX * (1 - imageScale) + diffTranslateX;
    const newImageTranslateY =
      imageTranslateY + relativeTranslateY * (1 - imageScale) + diffTranslateY;

    setImage((s) => {
      s.width = newImageWidth;
      s.height = newImageHeight;
      s.translateX = newImageTranslateX;
      s.translateY = newImageTranslateY;
    });
    setClip((s) => {
      s.width = newClipWidth;
      s.height = newClipHeight;
      s.translateX = newClipTranslateX;
      s.translateY = newClipTranslateY;
      s.committing = false;
    });
  };
  const onClipMove = (touch) => {
    const { prev, scaleStyle } = clip;
    const dx = touch.clientX - prev.clientX;
    const dy = touch.clientY - prev.clientY;
    const { width, height } = s;

    setClip((s) => {
      s.prev = touch;
    });

    const transByDir = (dir) => {
      switch (dir) {
        case "left":
          setClip((s) => {
            s.translateX = Math.min(width - 50, Math.max(0, s.translateX + dx));
            s.width = Math.min(
              width - s.translateX,
              Math.max(50, s.width - dx),
            );
          });
          break;
        case "right":
          setClip((s) => {
            s.width = Math.min(
              width - s.translateX,
              Math.max(50, s.width + dx),
            );
          });
          break;
        case "top":
          setClip((s) => {
            s.translateY = Math.min(
              height - 50,
              Math.max(0, s.translateY + dy),
            );
            s.height = Math.min(
              height - s.translateY,
              Math.max(50, s.height - dy),
            );
          });
          break;
        case "bottom":
          setClip((s) => {
            s.height = Math.min(
              height - s.translateY,
              Math.max(50, s.height + dy),
            );
          });
          break;
      }
    };

    switch (scaleStyle) {
      case "left":
        transByDir("left");
        break;
      case "right":
        transByDir("right");
        break;
      case "top":
        transByDir("top");
        break;
      case "bottom":
        transByDir("bottom");
        break;
      case "ratio-lt":
        transByDir("left");
        transByDir("top");
        break;
      case "ratio-rt":
        transByDir("right");
        transByDir("top");
        break;
      case "ratio-lb":
        transByDir("left");
        transByDir("bottom");
        break;
      case "ratio-rb":
        transByDir("right");
        transByDir("bottom");
        break;
    }
  };

  const onPanMove = (touch) => {
    const { prevPanPoint: prev } = gesture;
    const dx = touch.clientX - prev.clientX;
    const dy = touch.clientY - prev.clientY;
    console.log("pan move", dx, dy);
    const { translateX, translateY } = image;
    let newTranslateX, newTranslateY;
    newTranslateX = Math.min(
      clip.translateX,
      Math.max(clip.translateX + clip.width - image.width, translateX + dx),
    );
    newTranslateY = Math.min(
      clip.translateY,
      Math.max(clip.translateY + clip.height - image.height, translateY + dy),
    );

    setGesture((s) => {
      s.prevPanPoint = touch;
    });
    setImage((s) => {
      s.translateX = newTranslateX;
      s.translateY = newTranslateY;
    });
  };

  const onClipTouchStart = (e, scaleStyle) => {
    if (commitClipTimerRef.current) {
      clearTimeout(commitClipTimerRef.current);
      commitClipTimerRef.current = null;
    }

    setClip((s) => {
      s.scaling = true;
      s.prev = e.touches[0];
      s.scaleStyle = scaleStyle;
    });
  };
  const onTouchMove = (e) => {
    if (clip.scaling) {
      onClipMove(e.touches[0]);
      return;
    } else if (gesture.panning) {
      onPanMove(e.touches[0]);
      return;
    } else if (gesture.pinching) {
    }
  };
  const onTouchCancel = () => {};
  const onTouchEnd = (e) => {
    if (clip.scaling) {
      setClip((s) => {
        s.scaling = false;
        s.scaleStyle = null;
        if (commitClipTimerRef.current) {
          clearTimeout(commitClipTimerRef.current);
          commitClipTimerRef.current = null;
        }
        commitClipTimerRef.current = setTimeout(commitClip, 1000);
      });
    } else if (gesture.pinching) {
      setGesture((s) => {
        s.pinching = false;
        s.prevPanPoint = null;
      });
    }
  };
  const onGestureStart = (e) => {
    const { touches } = e;
    if (touches.length === 2) {
      setGesture((s) => {
        s.pinching = true;
        s.panning = false;
      });
      return;
    } else if (touches.length === 1) {
      setGesture((s) => {
        s.pinching = false;
        s.panning = true;
        s.prevPanPoint = touches[0];
      });
      return;
    }
  };

  const cropImage = async () => {
    const scaleRate = 3;
    const canvas = Taro.createOffscreenCanvas({
      type: "2d",
      width: clip.width * scaleRate,
      height: clip.height * scaleRate,
    });
    const ctx = canvas.getContext("2d");
    const img = canvas.createImage();
    await new Promise((resolve) => {
      img.onload = resolve;
      img.src = image.imageSrc; // 要加载的图片 url
    });
    const relativeTranslateX = clip.translateX - image.translateX;
    const relativeTranslateY = clip.translateY - image.translateY;
    const rate = image.imageInfo.width / image.width;

    ctx.drawImage(
      img,
      relativeTranslateX * rate,
      relativeTranslateY * rate,
      clip.width * rate,
      clip.height * rate,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    const res = await Taro.canvasToTempFilePath({
      canvas,
      fileType: "png",
      quality,
    });

    const compressedRes = await Taro.compressImage({
      src: res.tempFilePath,
      quality,
    });
    await Taro.saveImageToPhotosAlbum({
      filePath: compressedRes.tempFilePath,
    });
    // setS((s) => {
    //   s.previewImage = res.tempFilePath;
    // });
  };

  return (
    <View
      className="cropper"
      onTouchMove={(e) => onTouchMove(e)}
      onTouchCancel={onTouchCancel}
      onTouchEnd={onTouchEnd}
      onTouchStart={onGestureStart}
    >
      {s.previewImage && (
        <Image
          style={{
            position: "absolute",
            zIndex: 1000,
            top: 0,
            left: 0,
            width: clip.width,
            height: clip.height,
          }}
          src={s.previewImage}
          mode="aspectFit"
        />
      )}
      {/* <Canvas canvasId="cropper-canvas" id="cropper-canvas" /> */}
      <View
        className="cropper-image-layer"
        style={{
          position: "relative",
          width: image.width,
          height: image.height,
          transform: `translate(${image.translateX}px, ${image.translateY}px)`,
          transition: "all 0.05s linear",
          willChange: "transform, width, height",
        }}
      >
        <View className="cropper-image-mask" />
        <Image
          src={image.imageSrc}
          mode="aspectFit"
          style={{
            position: "relative",
            zIndex: 0,
            width: "100%",
            height: "100%",
          }}
        />
      </View>
      <View
        className="cropper-clip"
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: clip.width,
          height: clip.height,
          transform: `translate(${clip.translateX}px, ${clip.translateY}px)`,
          transition: "all 0.05s linear",
          willChange: "transform, width, height",
        }}
      >
        {["left", "right", "top", "bottom"].map((dir) => (
          <View
            key={dir}
            className={`cropper-clip-edge cropper-clip-edge--${dir}`}
            onTouchStart={(e) => {
              onClipTouchStart(e, dir);
              e.stopPropagation();
              e.preventDefault();
            }}
          ></View>
        ))}

        {["lt", "rt", "lb", "rb"].map((dir) => (
          <View
            key={dir}
            className={`cropper-clip-corner cropper-clip-corner--${dir}`}
            onTouchStart={(e) => {
              onClipTouchStart(e, `ratio-${dir}`);
              e.stopPropagation();
              e.preventDefault();
            }}
          ></View>
        ))}

        <View className="cropper-clip-line cropper-clip-line--h cropper-clip-line--h--1"></View>
        <View className="cropper-clip-line cropper-clip-line--h cropper-clip-line--h--2"></View>
        <View className="cropper-clip-line cropper-clip-line--v cropper-clip-line--v--1"></View>
        <View className="cropper-clip-line cropper-clip-line--v cropper-clip-line--v--2"></View>
      </View>

      <View className="cropper-action-wrapper" style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        zIndex:9999
      }}>
        <View className="cropper-action">cancel</View>
        <View className="cropper-action">back</View>
        <View className="cropper-action">rotate</View>
        <View
          className="cropper-action"
          style={{
            color: "#fff",
          }}
          onClick={cropImage}
        >
          confirm
        </View>
      </View>
    </View>
  );
});

export default ImageCropper;
