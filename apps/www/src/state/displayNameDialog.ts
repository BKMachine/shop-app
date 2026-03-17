import { reactive } from 'vue';

type DisplayNameDialogState = {
  open: boolean;
  reason?: string;
};

export const displayNameDialogState = reactive<DisplayNameDialogState>({
  open: false,
});

export function openDisplayNameDialog(
  reason = 'Your device needs a display name before continuing.',
) {
  displayNameDialogState.reason = reason;
  displayNameDialogState.open = true;
}

export function closeDisplayNameDialog() {
  displayNameDialogState.open = false;
}
