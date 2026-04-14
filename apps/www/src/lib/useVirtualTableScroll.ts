import { nextTick, onBeforeUnmount, onMounted, type Ref, ref } from 'vue';

type UseVirtualTableScrollOptions = {
  tableHost: Ref<HTMLElement | null>;
  canLoadMore: () => boolean;
  onLoadMore: () => void | Promise<void>;
  bottomThreshold?: number;
  preloadThreshold?: number;
  notScrollableThreshold?: number;
  minHeight?: number;
  bottomPadding?: number;
};

export function useVirtualTableScroll(options: UseVirtualTableScrollOptions) {
  const tableHeight = ref(700);
  const isAtTableBottom = ref(false);
  const isTableScrollable = ref(false);
  let scrollElement: HTMLElement | null = null;

  function updateIsAtTableBottom() {
    if (!scrollElement) {
      isAtTableBottom.value = false;
      isTableScrollable.value = false;
      return;
    }

    const remaining =
      scrollElement.scrollHeight - scrollElement.scrollTop - scrollElement.clientHeight;

    const bottomThreshold = options.bottomThreshold ?? 8;
    isTableScrollable.value =
      scrollElement.scrollHeight > scrollElement.clientHeight + bottomThreshold;
    isAtTableBottom.value = remaining <= bottomThreshold;
  }

  async function loadMoreIfTableNotScrollable() {
    await nextTick();
    updateIsAtTableBottom();
    if (!scrollElement) return;
    if (!options.canLoadMore()) return;

    const notScrollableThreshold = options.notScrollableThreshold ?? 24;
    if (scrollElement.scrollHeight <= scrollElement.clientHeight + notScrollableThreshold) {
      await options.onLoadMore();
    }
  }

  function handleTableScroll() {
    if (!scrollElement) return;

    updateIsAtTableBottom();
    if (!options.canLoadMore()) return;

    const remaining =
      scrollElement.scrollHeight - scrollElement.scrollTop - scrollElement.clientHeight;

    if (remaining <= (options.preloadThreshold ?? 240)) {
      void options.onLoadMore();
    }
  }

  async function bindScrollElement() {
    await nextTick();
    const nextScrollElement = options.tableHost.value?.querySelector(
      '.v-table__wrapper',
    ) as HTMLElement | null;

    if (scrollElement === nextScrollElement) {
      await loadMoreIfTableNotScrollable();
      return;
    }

    if (scrollElement) {
      scrollElement.removeEventListener('scroll', handleTableScroll);
    }

    scrollElement = nextScrollElement;
    if (scrollElement) {
      scrollElement.addEventListener('scroll', handleTableScroll, { passive: true });
    }

    updateIsAtTableBottom();
    await loadMoreIfTableNotScrollable();
  }

  function updateTableHeight() {
    if (!options.tableHost.value) return;

    const rect = options.tableHost.value.getBoundingClientRect();
    const viewportHeight = window.visualViewport?.height || window.innerHeight;
    const bottomPadding = options.bottomPadding ?? 32;
    const minHeight = options.minHeight ?? 320;
    const nextHeight = Math.max(minHeight, Math.floor(viewportHeight - rect.top - bottomPadding));
    tableHeight.value = nextHeight;
    updateIsAtTableBottom();
  }

  onMounted(() => {
    updateTableHeight();
    window.addEventListener('resize', updateTableHeight);
    void bindScrollElement();
  });

  onBeforeUnmount(() => {
    if (scrollElement) {
      scrollElement.removeEventListener('scroll', handleTableScroll);
    }
    window.removeEventListener('resize', updateTableHeight);
  });

  return {
    bindScrollElement,
    isAtTableBottom,
    isTableScrollable,
    tableHeight,
    updateIsAtTableBottom,
    updateTableHeight,
  };
}
