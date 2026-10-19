import { GOOGLE_CALENDAR_ENABLED } from '../config/features';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw, RefreshCw, BellOff, XCircle } from 'lucide-react';
import { fetchUpcomingEvent, type CalendarEvent } from '../services/calendar';
import { initAuth, getAccessToken, type User } from '../services/firebase';
import { sound } from '../services/sound';

export interface SmartphoneNotification {
  id: string;
  appName: string;
  appColor: string;
  title: string;
  text: string;
  time: string;
}

interface WidgetsPanelProps {
  onAlarmTrigger?: () => void;
  onCalendarConnectionChange?: (connected: boolean) => void;
}

export const WidgetsPanel: React.FC<WidgetsPanelProps> = ({
  onAlarmTrigger,
  onCalendarConnectionChange,
}) => {
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
  // "「Googleログイン」ボタンは設定画面に移動し、連携前はカレンダー予定表示の欄は非表示とする"
  const [user, setUser] = useState<User | null>(null);
  const [calendarEvent, setCalendarEvent] = useState<CalendarEvent | null>(null);
  const [loadingCalendar, setLoadingCalendar] = useState<boolean>(false);

  // Load calendar event from OAuth access token
  const loadEvent = useCallback(async (token: string) => {
    setLoadingCalendar(true);
    try {
      const evt = await fetchUpcomingEvent(token);
      setCalendarEvent(evt);
    } catch (err: unknown) {
      console.error('Failed to load calendar event:', err);
    } finally {
      setLoadingCalendar(false);
    }
  }, []);

  // Listen to Auth State
  useEffect(() => {
    if (!GOOGLE_CALENDAR_ENABLED) return;
    const unsubscribe = initAuth(
      (currentUser, token) => {
        setUser(currentUser);
        loadEvent(token);
        if (onCalendarConnectionChange) onCalendarConnectionChange(true);
      },
      () => {
        setUser(null);
        setCalendarEvent(null);
        if (onCalendarConnectionChange) onCalendarConnectionChange(false);
      }
    );
    return () => unsubscribe();
  }, [loadEvent, onCalendarConnectionChange]);

  // Periodic refresh (every 5 minutes)
  useEffect(() => {
    if (!GOOGLE_CALENDAR_ENABLED) return;
    const interval = setInterval(async () => {
      const token = await getAccessToken();
      if (token) {
        loadEvent(token);
      }
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadEvent]);

  // ===================== 3. SMARTPHONE NOTIFICATIONS =====================
  // "スマホの通知は取れない場合は何も表示しない"
  const [notifications, setNotifications] = useState<SmartphoneNotification[]>([]);
  const [currentNotifIndex, setCurrentNotifIndex] = useState<number>(0);

  // Listen to incoming native notifications from Android NotificationListenerService
  useEffect(() => {
    const handleNativeNotification = (event: CustomEvent<SmartphoneNotification> | MessageEvent) => {
      const data = 'detail' in event ? event.detail : (event.data as SmartphoneNotification);
      if (data && data.text) {
        setNotifications((prev) => [
          {
            id: String(Date.now()),
            appName: data.appName || '通知',
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
    const cycleTimer = setInterval(() => {
      setCurrentNotifIndex((prev) => (prev + 1) % notifications.length);
    }, 15000); // 15 seconds!

    return () => clearInterval(cycleTimer);
  }, [notifications.length]);

  const activeNotif = notifications[currentNotifIndex];
  const isCalendarConnected = GOOGLE_CALENDAR_ENABLED && (!!user || !!calendarEvent);

  return (
    /* "Google連携できていないときは、カウントダウンタイマー等の領域のコンテンツは上下真ん中に配置し、
       Google連携できているときは、カウントダウンタイマー等の領域は上下の上側に配置する" */
    <div
      className={`flex flex-col w-full h-full max-w-lg mx-auto py-1 px-1 sm:px-2 gap-2 select-none overflow-hidden transition-all duration-500 ${
        isCalendarConnected ? 'justify-start pt-2' : 'justify-center'
      }`}
    >
      {/* 1. COUNTDOWN TIMER:
          "カウントダウンタイマー、カレンダー予定、スマホ通知の欄は背景は透過とする" */}
      <div
        className={`relative rounded-2xl p-2 sm:p-2.5 transition-all duration-300 shrink-0 bg-transparent ${
          timerCompletedFlash
            ? 'ring-2 ring-rose-500/80 shadow-lg shadow-rose-900/60 bg-rose-950/70'
            : 'border border-purple-500/20'
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

      {/* 2. GOOGLE CALENDAR NEXT EVENT (Only shown when connected!)
          "連携前はカレンダー予定表示の欄は非表示とする"
          "カウントダウンタイマー、カレンダー予定、スマホ通知の欄は背景は透過とする"
          "カレンダー予定、スマホ通知の文章が入る欄は背景を透過としない" */}
      {isCalendarConnected && (
        <div className="relative rounded-2xl bg-transparent shrink-0">
          {/* Inner card with opaque background so text is perfectly readable! */}
          <div className="relative rounded-xl p-2.5 bg-slate-900/90 backdrop-blur-md border border-purple-500/30 shadow-lg min-h-[48px] flex flex-col justify-center">
            {/* Refresh button */}
            <button
              onClick={async () => {
                const token = await getAccessToken();
                if (token) loadEvent(token);
              }}
              disabled={loadingCalendar}
              className="absolute top-2 right-2 text-purple-300/70 hover:text-white p-0.5 rounded transition cursor-pointer"
              title="予定を更新"
            >
              <RefreshCw className={`w-3 h-3 ${loadingCalendar ? 'animate-spin' : ''}`} />
            </button>

            {loadingCalendar ? (
              <div className="py-1 text-center text-xs text-purple-300/70">
                予定を読み込み中...
              </div>
            ) : calendarEvent ? (
              <div className="flex flex-col gap-0.5 pr-6">
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
              <div className="py-1 text-center text-[11px] text-purple-300/60">
                直近の予定はありません
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. SMARTPHONE NOTIFICATION (Only displayed when phone notifications are available)
          "カウントダウンタイマー、カレンダー予定、スマホ通知の欄は背景は透過とする"
          "カレンダー予定、スマホ通知の文章が入る欄は背景を透過としない" */}
      {notifications.length > 0 && activeNotif && (
        <div className="relative rounded-2xl bg-transparent shrink-0">
          {/* Inner card with opaque background */}
          <div className="relative rounded-xl p-2.5 bg-slate-900/90 backdrop-blur-md border border-purple-500/30 shadow-lg min-h-[46px] flex flex-col justify-center overflow-hidden">
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
          </div>
        </div>
      )}
    </div>
  );
};
