import { Composition } from "remotion";
import { HelixPromo } from "./HelixPromo";
import { HelixInboxHowto } from "./HelixInboxHowto";
import { HelixCommerceHowto } from "./HelixCommerceHowto";
import { HelixLegalHowto } from "./HelixLegalHowto";
import { DURATION_FRAMES, FPS, HEIGHT, WIDTH } from "./theme";
import { INBOX_DURATION_FRAMES } from "./inboxTheme";
import { COMMERCE_DURATION_FRAMES } from "./commerceTheme";
import { LEGAL_DURATION_FRAMES } from "./legalTheme";
import "./index.css";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="HelixForInboxHowto"
        component={HelixInboxHowto}
        durationInFrames={INBOX_DURATION_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="HelixForCommerceHowto"
        component={HelixCommerceHowto}
        durationInFrames={COMMERCE_DURATION_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="HelixForLegalHowto"
        component={HelixLegalHowto}
        durationInFrames={LEGAL_DURATION_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="HelixForLeads"
        component={HelixPromo}
        durationInFrames={DURATION_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    </>
  );
};
