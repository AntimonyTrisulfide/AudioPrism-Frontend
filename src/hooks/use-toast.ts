// src/hooks/use-toast.ts
import { toast as sonnerToast, Toaster as SonnerToaster } from "sonner";

/**
 * Lightweight wrapper to adapt older `useToast()` usage to Sonner.
 * Keeps a similar API surface: { toast: { success, error, info, raw } }
 *
 * NOTE: We don't import sonner types directly to avoid version/type mismatches.
 */
type ToastOpts = any;

export function useToast() {
  return {
    toast: {
      success: (msg: string, opts?: ToastOpts) => sonnerToast.success(msg, opts),
      error: (msg: string, opts?: ToastOpts) => sonnerToast.error(msg, opts),
      info: (msg: string, opts?: ToastOpts) => sonnerToast(msg, opts),
      raw: (msg: string, opts?: ToastOpts) => sonnerToast(msg, opts),
    },
  };
}

// Export the Sonner Toaster component so you can mount it at the app root:
// import { AppToaster } from "@/hooks/use-toast"; <AppToaster />
export const AppToaster = SonnerToaster;

export default useToast;
