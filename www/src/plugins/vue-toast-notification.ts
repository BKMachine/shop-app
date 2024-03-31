import 'vue-toast-notification/dist/theme-bootstrap.css';

import ToastPlugin, { useToast } from 'vue-toast-notification';

export default ToastPlugin;

const $toast = useToast({
  position: 'top-right',
  duration: 3000,
});

export function toastSuccess(message: string) {
  $toast.success(message);
}
