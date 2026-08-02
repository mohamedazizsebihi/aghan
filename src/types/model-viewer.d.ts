import "react";

/**
 * Only the <model-viewer> attributes this app actually sets. Keeping it to
 * that (rather than pulling in the library's full element type) means a typo
 * in a new attribute is a compile error instead of a silently ignored one.
 */
declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          ref?: React.Ref<HTMLElement>;
          src?: string;
          alt?: string;
          poster?: string;
          // AR
          ar?: boolean;
          "ar-modes"?: string;
          /** "auto" lets the user resize; "fixed" pins the model to its real-world size. */
          "ar-scale"?: "auto" | "fixed";
          "ar-placement"?: "floor" | "wall";
          "xr-environment"?: boolean;
          // Controls
          "camera-controls"?: boolean;
          "touch-action"?: "pan-x" | "pan-y" | "none";
          "auto-rotate"?: boolean;
          "rotation-per-second"?: string;
          "disable-zoom"?: boolean;
          // Rendering
          "shadow-intensity"?: string;
          "environment-image"?: string;
          exposure?: string;
          // Loading
          loading?: "auto" | "lazy" | "eager";
          reveal?: "auto" | "manual";
        },
        HTMLElement
      >;
    }
  }
}
