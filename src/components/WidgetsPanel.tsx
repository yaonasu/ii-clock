import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw, RefreshCw, BellOff, XCircle } from 'lucide-react';
import { fetchUpcomingEvent, type CalendarEvent } from '../services/calendar';
import { googleSignIn, initAuth, getStoredAccessToken, logout, type User } from '../services/firebase';
import { sound } from '../services/sound';

export interface SmartphoneNotification {
  id: string;
  appName: string;
  appColor: string;
  title: string;
  text: string;
  time: string;
}

// Sample smartphone notifications for realistic display
const DEFAULT_PHONE_NOTIFICATIONS: SmartphoneNotification[] = [
  {
    id: 'notif-1',
    appName: 'LINE',
    appColor: 'bg-emerald-500 text-white',
    title: '田中 健一',
    text: '了解です！今日の資料確認しておきます。',
    time: '3分前',
  },
  {
    id: 'notif-2',
    appName: 'Gmail',
    appColor: 'bg-rose-500 text-white',
    title: 'Google カレンダー',
    text: 'リマインダー: 14:00 プロジェクト定例会',
    time: '12分前',
  },
  {
    id: 'notif-3',
    appName: 'メッセージ',
    appColor: 'bg-blue-500 text-white',
    title: '090-1234-5678',
    text: '認証番号は [582914] です。有効期限は10分です。',
    time: '25分前',
  },
  {
    id: 'notif-4',
    appName: 'リマインダー',
    appColor: 'bg-amber-500 text-white',
    title: '今日のタスク',
    text: '帰りに牛乳とコーヒー豆を買う',
    time: '45分前',
  },
];

interface WidgetsPanelProps {
  onAlarmTrigger?: () => void;
}

export const WidgetsPanel: React.FC<WidgetsPanelProps> = ({ onAlarmTrigger }) => {
  // ===================== 1. COUNTDOWN TIMER STATE =====================
  const [timerDuration, setTimerDuration] = useState<number>(300); // 5 minutes default
  const [timeLeft, setTimeLeft] = useState<number>(300);
  const [timerRunning, setTimerRunning] = useState<boolean>(false);
  const [timerCompletedFlash, setTimerCompletedFlash] = useState<boolean>(false);
  const [alarmSecondsLeft, setAlarmSecondsLeft] = useState<number>(30);

  // Vibration & Alarm refs
  const vibrateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const vibrateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const alarmCountdownRef = useRef<NodeJS.Timeout | null>(null);

  // Stable references for timer
  const endTimeRef = useRef<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const timerDurationRef = useRef(timerDuration);
  useEffect(() => {
    timerDurationRef.current = timerDuration;
  }, [timerDuration]);

  // Stop Vibration & Alarm Helper
  const stopAlarm = useCallback(() => {
    if (vibrateIntervalRef.current) {
      clearInterval(vibrateIntervalRef.current);
      vibrateIntervalRef.current = null;
    }
    if (vibrateTimeoutRef.current) {
      clearTimeout(vibrateTimeoutRef.current);
      vibrateTimeoutRef.current = null;
    }
    if (alarmCountdownRef.current) {
      clearInterval(alarmCountdownRef.current);
      alarmCountdownRef.current = null;
    }
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(0);
      } catch {
        // ignore
      }
    }
    setTimerCompletedFlash(false);
  }, []);

  // Trigger Alarm & Vibration (Max 30s)
  const triggerAlarmAndVibration = useCallback(() => {
    stopAlarm();

    sound.playAlarm();
    setTimerCompletedFlash(true);
    setAlarmSecondsLeft(30);
    if (onAlarmTrigger) onAlarmTrigger();

    // Repeating vibration pattern for 30s
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([600, 300, 600, 300, 600, 500]);
        vibrateIntervalRef.current = setInterval(() => {
          if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate([600, 300, 600, 300, 600, 500]);
          }
        }, 2800);
      } catch (e) {
        console.warn('Vibration API error:', e);
      }
    }

    alarmCountdownRef.current = setInterval(() => {
      setAlarmSecondsLeft((prev) => {
        if (prev <= 1) {
          stopAlarm();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    vibrateTimeoutRef.current = setTimeout(() => {
      stopAlarm();
    }, 30000);
  }, [stopAlarm, onAlarmTrigger]);

  useEffect(() => {
    return () => stopAlarm();
  }, [stopAlarm]);

  // Robust Timestamp-based Countdown
  useEffect(() => {
    if (!timerRunning) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    if (!endTimeRef.current) {
      const remainingSec = timeLeft > 0 ? timeLeft : (timerDurationRef.current > 0 ? timerDurationRef.current : 0);
      if (remainingSec <= 0) {
        setTimerRunning(false);
        return;
      }
      endTimeRef.current = Date.now() + remainingSec * 1000;
    }

    const checkTimer = () => {
      if (!endTimeRef.current) return;
      const diffMs = endTimeRef.current - Date.now();
      const remainingSec = Math.max(0, Math.ceil(diffMs / 1000));

      setTimeLeft(remainingSec);

      if (remainingSec <= 0) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        endTimeRef.current = null;
        setTimerRunning(false);
        triggerAlarmAndVibration();
      }
    };

    checkTimer();
    timerRef.current = setInterval(checkTimer, 200);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [timerRunning, triggerAlarmAndVibration]);

  const handleStartPause = () => {
    if (timerCompletedFlash) {
      stopAlarm();
    }

    if (timerRunning) {
      if (endTimeRef.current) {
        const remainingSec = Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000));
        setTimeLeft(remainingSec);
      }
      endTimeRef.current = null;
      setTimerRunning(false);
    } else {
      if (timeLeft <= 0) return;
      const targetSec = timeLeft;
      setTimeLeft(targetSec);
      setTimerDuration(targetSec);
      endTimeRef.current = Date.now() + targetSec * 1000;
      setTimerRunning(true);
    }
  };

  const handleReset = () => {
    stopAlarm();
    setTimerRunning(false);
    endTimeRef.current = null;
    setTimeLeft(timerDuration);
  };

  // Clear timer: initial value becomes 0:00
  const handleClear = () => {
    stopAlarm();
    setTimerRunning(false);
    endTimeRef.current = null;
    setTimeLeft(0);
    setTimerDuration(0);
  };

  const handleAdjustTime = (deltaSeconds: number) => {
    if (timerCompletedFlash) {
      stopAlarm();
    }

    const currentRemaining = timerRunning && endTimeRef.current
      ? Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000))
      : timeLeft;

    const next = Math.max(0, currentRemaining + deltaSeconds);
    setTimeLeft(next);
    setTimerDuration(next);

    if (timerRunning) {
      if (next === 0) {
        setTimerRunning(false);
        endTimeRef.current = null;
      } else {
        endTimeRef.current = Date.now() + next * 1000;
      }
    }
  };

  const formatTimer = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) {
      return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const progressPercent = timerDuration > 0 ? ((timerDuration - timeLeft) / timerDuration) * 100 : 0;

  // ===================== 2. GOOGLE CALENDAR STATE =====================
  const [user, setUser] = useState<User | null>(null);
  const [calendarEvent, setCalendarEvent] = useState<CalendarEvent | null>(null);
  const [loadingCalendar, setLoadingCalendar] = useState<boolean>(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);
  const [showCalendarHelp, setShowCalendarHelp] = useState<boolean>(false);

  // Load calendar event
  const loadEvent = useCallback(async (token: string) => {
    setLoadingCalendar(true);
    setCalendarError(null);
    try {
      const evt = await fetchUpcomingEvent(token);
      setCalendarEvent(evt);
    } catch (err: unknown) {
      console.error('Failed to load event:', err);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === 'UNAUTHORIZED') {
        logout();
        setUser(null);
        setCalendarError('セッションが切れました。再度ログインしてください。');
      } else {
        setCalendarError('カレンダーの最新予定を取得できませんでした');
      }
    } finally {
      setLoadingCalendar(false);
    }
  }, []);

  // Listen to Auth State
  useEffect(() => {
    const storedToken = getStoredAccessToken();
    const unsubscribe = initAuth(
      (currentUser, token) => {
        setUser(currentUser);
        loadEvent(token);
      },
      () => {
        if (storedToken) {
          loadEvent(storedToken);
        } else {
          setUser(null);
          setCalendarEvent(null);
        }
      }
    );
    return () => unsubscribe();
  }, [loadEvent]);

  // Periodic refresh for calendar (every 5 minutes)
  useEffect(() => {
    const token = getStoredAccessToken();
    if (!token) return;
    const interval = setInterval(() => {
      loadEvent(token);
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadEvent]);

  // Robust Sign In handler with clear feedback
  const handleSignIn = async () => {
    setIsSigningIn(true);
    setCalendarError(null);
    setShowCalendarHelp(false);
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        await loadEvent(res.accessToken);
      }
    } catch (err: unknown) {
      console.error('Sign in error:', err);
      const errStr = err instanceof Error ? err.message : String(err);
      if (errStr.includes('popup-blocked') || errStr.includes('popup-closed')) {
        setCalendarError('ポップアップがブロックされました。ブラウザのポップアップを許可してください。');
        setShowCalendarHelp(true);
      } else {
        setCalendarError(`ログインに失敗しました: ${errStr}`);
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  // Mock sample schedule for quick testing when offline or in preview
  const handleSetSampleCalendar = () => {
    const now = new Date();
    const startTime = new Date(now.getTime() + 45 * 60 * 1000);
    const endTime = new Date(now.getTime() + 105 * 60 * 1000);
    setCalendarEvent({
      id: 'sample-1',
      summary: 'プロジェクト進捗確認ミーティング',
      start: { dateTime: startTime.toISOString() },
      end: { dateTime: endTime.toISOString() },
      location: '第2会議室 / Google Meet',
      isAllDay: false,
      timeFormatted: `今日 ${startTime.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} 〜 ${endTime.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}`,
      relativeTime: 'あと 45 分後',
    });
    setCalendarError(null);
  };

  // ===================== 3. SMARTPHONE NOTIFICATIONS =====================
  // "通知は本アプリの通知ではなくて、インストールされたスマホの通知を表示する"
  // "通知の最新から順番に１５秒づつ表示する"
  const [notifications, setNotifications] = useState<SmartphoneNotification[]>(DEFAULT_PHONE_NOTIFICATIONS);
  const [currentNotifIndex, setCurrentNotifIndex] = useState<number>(0);
  const [notifProgress, setNotifProgress] = useState<number>(0);

  // Listen to incoming native notifications from Android NotificationListenerService
  useEffect(() => {
    const handleNativeNotification = (event: CustomEvent<SmartphoneNotification> | MessageEvent) => {
      const data = 'detail' in event ? event.detail : (event.data as SmartphoneNotification);
      if (data && data.text) {
        setNotifications((prev) => [
          {
            id: String(Date.now()),
            appName: data.appName || 'スマホ通知',
            appColor: 'bg-indigo-500 text-white',
            title: data.title || '',
            text: data.text,
            time: '今',
          },
          ...prev.slice(0, 9),
        ]);
        setCurrentNotifIndex(0);
      }
    };

    window.addEventListener('smartphone_notification' as any, handleNativeNotification);
    window.addEventListener('message', handleNativeNotification);

    return () => {
      window.removeEventListener('smartphone_notification' as any, handleNativeNotification);
      window.removeEventListener('message', handleNativeNotification);
    };
  }, []);

  // 15-second cycle through latest notifications
  useEffect(() => {
    if (notifications.length === 0) return;

    // Reset progress to 0
    setNotifProgress(0);

    const progressStepMs = 100;
    const totalMs = 15000; // 15 seconds!

    const progressTimer = setInterval(() => {
      setNotifProgress((prev) => Math.min(100, prev + (progressStepMs / totalMs) * 100));
    }, progressStepMs);

    const cycleTimer = setInterval(() => {
      setCurrentNotifIndex((prev) => (prev + 1) % notifications.length);
      setNotifProgress(0);
    }, totalMs);

    return () => {
      clearInterval(progressTimer);
      clearInterval(cycleTimer);
    };
  }, [notifications.length, currentNotifIndex]);

  const activeNotif = notifications[currentNotifIndex] || notifications[0];

  return (
    <div className="flex flex-col justify-between w-full h-full max-w-lg mx-auto py-1 px-1 sm:px-2 gap-1.5 select-none overflow-hidden">
      {/* 1. COUNTDOWN TIMER */}
      <div
        className={`relative rounded-xl p-1.5 sm:p-2 transition-all duration-300 border shrink-0 ${
          timerCompletedFlash
            ? 'bg-rose-950/85 border-rose-500 shadow-lg shadow-rose-900/60 ring-2 ring-rose-500/50'
            : 'bg-black/45 backdrop-blur-md border-purple-500/20 shadow-md'
        }`}
      >
        {/* Digits & Progress */}
        <div className="flex flex-col items-center justify-center">
          <div className="text-2xl sm:text-3xl font-mono font-bold tracking-wider text-white drop-shadow">
            {formatTimer(timeLeft)}
          </div>
          <div className="w-full bg-purple-950/50 h-1 rounded-full mt-0.5 overflow-hidden border border-purple-800/20">
            <div
              className={`h-full transition-all duration-300 ${
                timeLeft <= 10 && timerRunning ? 'bg-rose-500' : 'bg-purple-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Buttons: 「スタート」「リセット」「クリア」 */}
        <div className="flex items-center justify-center gap-1.5 mt-1 sm:mt-1.5">
          {timerCompletedFlash ? (
            <button
              onClick={stopAlarm}
              className="flex items-center justify-center gap-1.5 w-full py-1.5 px-3 rounded-lg font-bold text-xs bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-900/60 animate-bounce cursor-pointer active:scale-95"
            >
              <BellOff className="w-4 h-4" />
              <span>振動・アラーム停止 (残り{alarmSecondsLeft}秒)</span>
            </button>
          ) : (
            <>
              <button
                onClick={handleStartPause}
                disabled={timeLeft <= 0 && !timerRunning}
                className={`flex items-center justify-center gap-1 px-3 py-1 rounded-lg font-semibold text-xs transition shadow cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
                  timerRunning
                    ? 'bg-amber-600/95 hover:bg-amber-600 text-white'
                    : 'bg-purple-600 hover:bg-purple-500 text-white'
                }`}
              >
                {timerRunning ? (
                  <>
                    <Pause className="w-3.5 h-3.5 fill-current" /> 一時停止
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" /> スタート
                  </>
                )}
              </button>

              <button
                onClick={handleReset}
                disabled={timerDuration <= 0}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-purple-200 text-xs font-medium transition cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                title="元の時間にリセット"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>リセット</span>
              </button>

              <button
                onClick={handleClear}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 border border-rose-500/30 text-rose-200 text-xs font-medium transition cursor-pointer active:scale-95"
                title="タイマーを0分にクリア"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>クリア</span>
              </button>
            </>
          )}
        </div>

        {/* ＋１分、＋３分、＋５分、＋１０分 & ー１分、ー３分、ー５分、ー１０分 */}
        <div className="flex flex-col gap-1 mt-1 sm:mt-1.5 pt-1 border-t border-purple-500/10">
          <div className="grid grid-cols-4 gap-1">
            {[
              { label: '＋１分', sec: 60 },
              { label: '＋３分', sec: 180 },
              { label: '＋５分', sec: 300 },
              { label: '＋１０分', sec: 600 },
            ].map((btn, idx) => (
              <button
                key={`plus-${idx}`}
                onClick={() => handleAdjustTime(btn.sec)}
                className="py-0.5 px-0.5 text-[10px] sm:text-[11px] font-medium rounded bg-purple-950/70 hover:bg-purple-800/80 text-purple-200 border border-purple-500/30 transition text-center cursor-pointer active:scale-95"
              >
                {btn.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-4 gap-1">
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
                className="py-0.5 px-0.5 text-[10px] sm:text-[11px] font-medium rounded bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border border-zinc-700/40 transition text-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. GOOGLE CALENDAR NEXT EVENT (1 item) */}
      <div className="relative rounded-xl p-1.5 sm:p-2 bg-black/45 backdrop-blur-md border border-purple-500/20 shadow-md flex flex-col justify-center shrink-0 min-h-[48px]">
        {user && (
          <button
            onClick={() => {
              const token = getStoredAccessToken();
              if (token) loadEvent(token);
            }}
            disabled={loadingCalendar}
            className="absolute top-1.5 right-1.5 text-purple-300/70 hover:text-white p-0.5 rounded transition cursor-pointer"
            title="予定を更新"
          >
            <RefreshCw className={`w-3 h-3 ${loadingCalendar ? 'animate-spin' : ''}`} />
          </button>
        )}

        {!user && !calendarEvent ? (
          <div className="flex items-center justify-center py-0.5">
            <button
              onClick={handleSignIn}
              disabled={isSigningIn}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-white text-gray-800 text-[11px] font-semibold hover:bg-gray-100 shadow transition cursor-pointer disabled:opacity-50 active:scale-95"
            >
              <svg viewBox="0 0 48 48" className="w-3.5 h-3.5">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
              </svg>
              <span>{isSigningIn ? '接続中...' : 'Googleログイン'}</span>
            </button>
          </div>
        ) : loadingCalendar ? (
          <div className="py-0.5 text-center text-xs text-purple-300/70">
            予定を読み込み中...
          </div>
        ) : calendarError ? (
          <div className="py-0.5 text-center text-[10px] text-rose-300">
            <span>{calendarError}</span>
            <button
              onClick={handleSignIn}
              className="block mx-auto mt-0.5 underline text-purple-300 hover:text-white"
            >
              再ログインする
            </button>
          </div>
        ) : calendarEvent ? (
          <div className="flex flex-col gap-0.5 pr-4">
            <div className="flex items-start justify-between gap-1">
              <span className="font-semibold text-xs sm:text-sm text-white line-clamp-1">
                {calendarEvent.summary}
              </span>
              <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 font-medium">
                {calendarEvent.relativeTime}
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-purple-200/80">
              <span className="truncate">{calendarEvent.timeFormatted}</span>
              {calendarEvent.location && (
                <span className="text-purple-300/70 truncate max-w-[120px] ml-1">
                  📍 {calendarEvent.location}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="py-0.5 text-center text-[11px] text-purple-300/60">
            直近の予定はありません
          </div>
        )}
      </div>

      {/* 3. SMARTPHONE NOTIFICATION (1 item, cycles every 15s) */}
      <div className="relative rounded-xl p-1.5 sm:p-2 bg-black/45 backdrop-blur-md border border-purple-500/20 shadow-md flex flex-col justify-center shrink-0 min-h-[46px] overflow-hidden">
        {activeNotif ? (
          <div className="flex items-start gap-2 transition-opacity duration-300">
            <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-md font-bold ${activeNotif.appColor}`}>
              {activeNotif.appName}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className="font-semibold text-xs text-amber-200 truncate">
                  {activeNotif.title}
                </span>
                <span className="text-[9px] text-purple-300/60 shrink-0">
                  {activeNotif.time}
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-white/90 truncate leading-tight">
                {activeNotif.text}
              </p>
            </div>
          </div>
        ) : (
          <div className="py-0.5 text-center text-[10px] text-purple-300/60">
            通知はありません
          </div>
        )}
      </div>
    </div>
  );
};
