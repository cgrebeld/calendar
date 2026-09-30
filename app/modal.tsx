import { useEffect, useRef, type DialogHTMLAttributes } from "react";

// Native modal dialog: traps focus, closes on Escape or a backdrop tap, and restores focus when unmounted.
export function Modal({ onClose, children, ...props }: Omit<DialogHTMLAttributes<HTMLDialogElement>, "onClose" | "onCancel" | "onClick"> & { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current!;
    const previouslyFocused = document.activeElement;
    element.showModal();
    return () => {
      element.close();
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, []);
  return <dialog ref={dialog} {...props} onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => {
    const box = event.currentTarget.getBoundingClientRect();
    if (event.target === event.currentTarget && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) onClose();
  }}>{children}</dialog>;
}
