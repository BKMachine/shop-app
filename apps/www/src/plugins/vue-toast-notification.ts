import 'vue-toast-notification/dist/theme-bootstrap.css';

import ToastPlugin, { useToast } from 'vue-toast-notification';

export default ToastPlugin;

// https://www.npmjs.com/package/vue-toast-notification

const $toast = useToast({
  position: 'top-right',
  duration: 3000,
});

export function toastSuccess(message: string) {
  $toast.success(message);
}

export function toastError(message: string) {
  $toast.error(message);
}
