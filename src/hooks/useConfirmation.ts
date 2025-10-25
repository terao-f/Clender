import { useState } from 'react';

interface ConfirmationOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

interface ConfirmationState {
  isOpen: boolean;
  options: ConfirmationOptions;
  resolve: ((value: boolean) => void) | null;
}

export const useConfirmation = () => {
  const [state, setState] = useState<ConfirmationState>({
    isOpen: false,
    options: { message: '' },
    resolve: null
  });

  const confirm = (options: ConfirmationOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({
        isOpen: true,
        options: {
          title: '確認',
          confirmText: 'はい',
          cancelText: 'いいえ',
          type: 'warning',
          ...options
        },
        resolve
      });
    });
  };

  const handleConfirm = () => {
    if (state.resolve) {
      state.resolve(true);
    }
    setState({
      isOpen: false,
      options: { message: '' },
      resolve: null
    });
  };

  const handleCancel = () => {
    if (state.resolve) {
      state.resolve(false);
    }
    setState({
      isOpen: false,
      options: { message: '' },
      resolve: null
    });
  };

  return {
    confirm,
    confirmationState: {
      isOpen: state.isOpen,
      title: state.options.title || '確認',
      message: state.options.message,
      confirmText: state.options.confirmText || 'はい',
      cancelText: state.options.cancelText || 'いいえ',
      type: state.options.type || 'warning'
    },
    handleConfirm,
    handleCancel
  };
};
