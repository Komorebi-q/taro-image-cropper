import { View, Text } from "@tarojs/components";
import { useLoad } from "@tarojs/taro";
import "./index.scss";

import ImageCropper from "../../cropper";

export default function Index() {
  useLoad(() => {
    console.log("Page loaded.");
  });

  return <ImageCropper />;
}
