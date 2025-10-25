import { useEffect } from 'react';

export function usePreventPullToRefresh() {
  useEffect(() => {
    let touchStartY = 0;
    let lastTouchY = 0;
    let maybePreventPullToRefresh = false;

    // タッチ開始時の処理
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      
      touchStartY = e.touches[0].clientY;
      lastTouchY = touchStartY;
      maybePreventPullToRefresh = window.pageYOffset === 0;
    };

    // タッチ移動時の処理
    const handleTouchMove = (e: TouchEvent) => {
      const touchY = e.touches[0].clientY;
      const touchYDelta = touchY - lastTouchY;
      lastTouchY = touchY;

      // スクロール可能な要素内でのタッチの場合は何もしない
      const target = e.target as HTMLElement;
      let scrollableParent = target;
      while (scrollableParent && scrollableParent !== document.body) {
        const style = window.getComputedStyle(scrollableParent);
        const overflow = style.overflow + style.overflowY;
        if (overflow.includes('auto') || overflow.includes('scroll')) {
          // スクロール可能な要素が見つかった場合
          if (scrollableParent.scrollTop > 0 || scrollableParent.scrollHeight > scrollableParent.clientHeight) {
            // スクロール可能な要素内でのタッチなので、デフォルトの動作を許可
            return;
          }
        }
        scrollableParent = scrollableParent.parentElement as HTMLElement;
      }

      if (maybePreventPullToRefresh) {
        // プルダウン更新をトリガーする可能性のある動き
        maybePreventPullToRefresh = window.pageYOffset === 0 && touchYDelta > 0;
      }

      // ページ最上部で下方向にスクロールしようとしている場合のみ
      if (window.pageYOffset === 0 && touchYDelta > 0) {
        // タッチ開始位置からの移動量をチェック
        if (touchY - touchStartY > 10) {
          // プルダウン更新を防ぐ
          e.preventDefault();
          return false;
        }
      }
    };

    // タッチ終了時の処理
    const handleTouchEnd = () => {
      maybePreventPullToRefresh = false;
    };

    // パッシブリスナーを無効にしてpreventDefaultを有効にする
    const options: AddEventListenerOptions = { passive: false };
    
    // タッチイベントリスナーを追加
    document.addEventListener('touchstart', handleTouchStart, options);
    document.addEventListener('touchmove', handleTouchMove, options);
    document.addEventListener('touchend', handleTouchEnd, options);

    // スクロールイベントも監視
    const handleScroll = () => {
      if (window.pageYOffset === 0) {
        document.body.style.overscrollBehavior = 'none';
      } else {
        document.body.style.overscrollBehavior = 'auto';
      }
    };

    window.addEventListener('scroll', handleScroll);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('scroll', handleScroll);
      document.body.style.overscrollBehavior = '';
    };
  }, []);
}