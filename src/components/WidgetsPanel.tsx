import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw, RefreshCw } from 'lucide-react';
import { fetchUpcomingEvent, type CalendarEvent } from '../services/calendar';
import { googleSignIn, getAccessToken, initAuth, type User } from '../services/firebase';
import { sound } from '../services/sound';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  time: string;
  type: 'timer' | 'calendar' | 'system';
}

interface WidgetsPanelProps {
  latestNotification: AppNotification | null;
  onNewNotification: (notif: AppNotification) => void;
  onClearNotification: () => void;
}

export const WidgetsPanel: React.FC<WidgetsPanelProps> = ({
  latestNotification,
  onNewNotification,
}) => {
  // ===================== TIMER STATE =====================
  const [timerDuration, setTimerDuration] = useState<number>(300); // 5 minutes default
  const [timeLeft, setTimeLeft] = useState<number>(300);
  const [timerRunning, setTimerRunning] = useState<boolean>(false);
  const [timerCompletedFlash, setTimerCompletedFlash] = useState<boolean>(false);

  // Interval ref
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Timer Tick
  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            setTimerRunning(false);
            sound.playAlarm();
            setTimerCompletedFlash(true);

            // Register notification
            const now = new Date();
            const timeStr = now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
            onNewNotification({
              id: Date.now().toString(),
              title: 'タイマー終了',
              message: `設定したタイマー (${Math.round(timerDuration / 60)}分) が終了しました！`,
              time: timeStr,
              type: 'timer',
            });

            // Browser Web Notification if permitted
            if ('Notification' in window && Notification.permission === 'granted') {
              try {
                new Notification('🍆 茄子置時計 タイマー終了', {
                  body: '設定したタイマーが完了しました！',
                  icon: '/favicon.ico',
                });
              } catch {
                // ignore
              }
            }

            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerRunning, timerDuration, onNewNotification]);

  // Handle flash reset
  useEffect(() => {
    if (timerCompletedFlash) {
      const timer = setTimeout(() => setTimerCompletedFlash(false), 8000);
      return () => clearTimeout(timer);
    }
  }, [timerCompletedFlash]);

  const handleStartPause = () => {
    if (timeLeft <= 0) {
      setTimeLeft(timerDuration > 0 ? timerDuration : 300);
      setTimerDuration(timerDuration > 0 ? timerDuration : 300);
    }
    setTimerRunning(!timerRunning);
  };

  const handleReset = () => {
    setTimerRunning(false);
    setTimeLeft(timerDuration);
    setTimerCompletedFlash(false);
  };

  // Adjust time by seconds (positive or negative)
  const handleAdjustTime = (deltaSeconds: number) => {
    const next = Math.max(0, timeLeft + deltaSeconds);
    setTimeLeft(next);
    setTimerDuration(next);
    if (next === 0) {
      setTimerRunning(false);
    }
  };

  // Timer format (HH:MM:SS or MM:SS)
  const formatTimer = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) {
      return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Progress percentage
  const progressPercent = timerDuration > 0 ? ((timerDuration - timeLeft) / timerDuration) * 100 : 0;

  // ===================== GOOGLE CALENDAR STATE =====================
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [calendarEvent, setCalendarEvent] = useState<CalendarEvent | null>(null);
  const [loadingCalendar, setLoadingCalendar] = useState<boolean>(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);

  // Load calendar event
  const loadEvent = useCallback(async (accessToken: string) => {
    setLoadingCalendar(true);
    setCalendarError(null);
    try {
      const evt = await fetchUpcomingEvent(accessToken);
      setCalendarEvent(evt);
    } catch (err: unknown) {
      console.error('Failed to load event:', err);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === 'UNAUTHORIZED') {
        setToken(null);
        setCalendarError('セッションの有効期限が切れました。再ログインしてください。');
      } else {
        setCalendarError('カレンダーの予定を取得できませんでした');
      }
    } finally {
      setLoadingCalendar(false);
    }
  }, []);

  // Listen to Auth State
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, accessToken) => {
        setUser(currentUser);
        setToken(accessToken);
        loadEvent(accessToken);
      },
      () => {
        setUser(null);
        setToken(null);
        setCalendarEvent(null);
      }
    );
    return () => unsubscribe();
  }, [loadEvent]);

  // Periodic refresh for calendar (every 5 minutes)
  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => {
      loadEvent(token);
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [token, loadEvent]);

  const handleSignIn = async () => {
    setIsSigningIn(true);
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setToken(res.accessToken);
        await loadEvent(res.accessToken);
      }
    } catch (err) {
      console.error('Sign in error:', err);
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <div className="flex flex-col justify-between w-full h-full max-w-lg mx-auto p-2 md:p-3 gap-2.5 select-none overflow-y-auto">
      {/* 1. TIMER (カウントダウンタイマー表記・時間指定なし、＋/ー 1, 3, 5, 10分ボタン) */}
      <div
        className={`relative rounded-2xl p-3 md:p-4 transition-all duration-300 border ${
          timerCompletedFlash
            ? 'bg-rose-950/80 border-rose-500 shadow-lg shadow-rose-900/50 animate-pulse'
            : 'bg-black/40 backdrop-blur-md border-purple-500/20 shadow-xl'
        }`}
      >
        {/* Timer Display */}
        <div className="flex flex-col items-center justify-center my-1">
          <div className="text-4xl md:text-5xl font-mono font-bold tracking-wider text-white drop-shadow-lg">
            {formatTimer(timeLeft)}
          </div>

          {/* Progress bar */}
          <div className="w-full bg-purple-950/50 h-1.5 rounded-full mt-2 overflow-hidden border border-purple-800/30">
            <div
              className={`h-full transition-all duration-300 ${
                timeLeft <= 10 && timerRunning ? 'bg-rose-500' : 'bg-purple-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Timer Control Buttons */}
        <div className="flex items-center justify-center gap-2 mt-2.5">
          <button
            onClick={handleStartPause}
            className={`flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-xl font-medium text-sm transition shadow-md cursor-pointer ${
              timerRunning
                ? 'bg-amber-600/80 hover:bg-amber-600 text-white'
                : 'bg-purple-600 hover:bg-purple-500 text-white'
            }`}
          >
            {timerRunning ? (
              <>
                <Pause className="w-4 h-4 fill-current" /> 一時停止
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" /> スタート
              </>
            )}
          </button>
          <button
            onClick={handleReset}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-purple-200 transition cursor-pointer"
            title="リセット"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* ＋１分、＋３分、＋５分、＋１０分 & ー１分、ー３分、ー５分、ー１０分 */}
        <div className="flex flex-col gap-1.5 mt-2.5 pt-2 border-t border-purple-500/10">
          {/* Plus Buttons */}
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { label: '＋１分', sec: 60 },
              { label: '＋３分', sec: 180 },
              { label: '＋５分', sec: 300 },
              { label: '＋１０分', sec: 600 },
            ].map((btn, idx) => (
              <button
                key={`plus-${idx}`}
                onClick={() => handleAdjustTime(btn.sec)}
                className="py-1 px-1 text-xs font-medium rounded-lg bg-purple-950/70 hover:bg-purple-800/80 text-purple-200 border border-purple-500/30 transition text-center cursor-pointer active:scale-95"
              >
                {btn.label}
              </button>
            ))}
          </div>

          {/* Minus Buttons */}
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { label: 'ー１分', sec: -60 },
              { label: 'ー３分', sec: -180 },
              { label: 'ー５分', sec: -300 },
              { label: 'ー１０分', sec: -600 },
            ].map((btn, idx) => (
              <button
                key={`minus-${idx}`}
                onClick={() => handleAdjustTime(btn.sec)}
                disabled={timeLeft <= 0}
                className="py-1 px-1 text-xs font-medium rounded-lg bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border border-zinc-700/40 transition text-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. GOOGLE CALENDAR NEXT EVENT (タイトル・説明表記なし) */}
      <div className="relative rounded-2xl p-3 md:p-3.5 bg-black/40 backdrop-blur-md border border-purple-500/20 shadow-xl min-h-[72px] flex flex-col justify-center">
        {token && (
          <button
            onClick={() => loadEvent(token)}
            disabled={loadingCalendar}
            className="absolute top-2.5 right-2.5 text-purple-300/70 hover:text-white p-1 rounded transition cursor-pointer z-10"
            title="予定を更新"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingCalendar ? 'animate-spin' : ''}`} />
          </button>
        )}

        {!user || !token ? (
          <div className="flex items-center justify-center py-1">
            <button
              onClick={handleSignIn}
              disabled={isSigningIn}
              className="gsi-material-button inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white text-gray-800 text-xs font-medium hover:bg-gray-100 shadow transition cursor-pointer disabled:opacity-50"
            >
              <div className="gsi-material-button-icon">
                <svg
                  version="1.1"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 48 48"
                  className="w-4 h-4"
                >
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                </svg>
              </div>
              <span>{isSigningIn ? '連携中...' : 'Googleでログイン'}</span>
            </button>
          </div>
        ) : loadingCalendar ? (
          <div className="py-2 text-center text-xs text-purple-300/70">
            予定を読み込み中...
          </div>
        ) : calendarError ? (
          <div className="py-1 text-center text-xs text-rose-300">
            {calendarError}
            <button
              onClick={handleSignIn}
              className="block mx-auto mt-1 underline text-purple-300 hover:text-white"
            >
              再認証する
            </button>
          </div>
        ) : calendarEvent ? (
          <div className="flex flex-col gap-1 pr-6">
            <div className="flex items-start justify-between gap-2">
              <span className="font-semibold text-sm md:text-base text-white line-clamp-1">
                {calendarEvent.summary}
              </span>
              <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 font-medium">
                {calendarEvent.relativeTime}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-purple-200/80">
              <span>{calendarEvent.timeFormatted}</span>
              {calendarEvent.location && (
                <span className="text-purple-300/70 truncate max-w-[140px]">
                  📍 {calendarEvent.location}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="py-1.5 text-center text-xs text-purple-300/60">
            直近の予定はありません
          </div>
        )}
      </div>

      {/* 3. LATEST NOTIFICATION (タイトル・クリアボタンなし) */}
      <div className="rounded-2xl p-3 md:p-3.5 bg-black/40 backdrop-blur-md border border-purple-500/20 shadow-xl min-h-[64px] flex flex-col justify-center">
        {latestNotification ? (
          <div className="flex items-start gap-2.5">
            <div className="shrink-0 w-2 h-2 mt-1.5 rounded-full bg-amber-400 animate-ping" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className="font-semibold text-xs text-amber-200 truncate">
                  {latestNotification.title}
                </span>
                <span className="text-[10px] text-purple-300/60 shrink-0">
                  {latestNotification.time}
                </span>
              </div>
              <p className="text-xs text-white/90 line-clamp-2 mt-0.5 leading-snug">
                {latestNotification.message}
              </p>
            </div>
          </div>
        ) : (
          <div className="py-1 text-center text-xs text-purple-300/60 flex items-center justify-center gap-2">
            <span>通知はありません</span>
            <button
              onClick={() => {
                const now = new Date();
                const timeStr = now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
                sound.playNotify();
                onNewNotification({
                  id: Date.now().toString(),
                  title: '時報 (テスト通知)',
                  message: '置時計は正常に稼働しています。',
                  time: timeStr,
                  type: 'system',
                });
              }}
              className="text-[10px] px-2 py-0.5 rounded bg-purple-900/40 hover:bg-purple-800/60 text-purple-300 border border-purple-400/20 cursor-pointer"
            >
              テスト
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
