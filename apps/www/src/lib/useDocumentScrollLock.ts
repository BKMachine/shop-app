import { onBeforeUnmount, onMounted } from 'vue';

export function useDocumentScrollLock() {
  let previousHtmlOverflow = '';
  let previousBodyOverflow = '';

  onMounted(() => {
    previousHtmlOverflow = document.documentElement.style.overflow;
    previousBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
  });

  onBeforeUnmount(() => {
    document.documentElement.style.overflow = previousHtmlOverflow;
    document.body.style.overflow = previousBodyOverflow;
  });
}
