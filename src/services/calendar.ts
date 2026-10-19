export interface CalendarEvent {
  id: string;
  summary: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
  location?: string;
  htmlLink?: string;
  isAllDay: boolean;
  timeFormatted: string;
  relativeTime: string;
}

function formatEventDisplay(startDate: Date, endDate: Date, isAllDay: boolean, now: Date) {
  const diffMs = startDate.getTime() - now.getTime();
  const diffMins = Math.round(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);

  let relativeTime = '';
  if (diffMs <= 0 && endDate.getTime() >= now.getTime()) {
    relativeTime = '現在進行中';
  } else if (diffMs <= 0) {
    relativeTime = '終了';
  } else if (diffMins < 60) {
    relativeTime = `あと ${diffMins} 分後`;
  } else if (diffHours < 24) {
    const remMins = diffMins % 60;
    relativeTime = `あと ${diffHours}時間${remMins > 0 ? remMins + '分' : ''}後`;
  } else {
    const days = Math.floor(diffHours / 24);
    relativeTime = `あと ${days} 日後`;
  }

  let timeFormatted = '';
  if (isAllDay) {
    timeFormatted = `${startDate.getMonth() + 1}月${startDate.getDate()}日 (終日)`;
  } else {
    const startStr = startDate.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' });
    const endStr = endDate.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' });
    const isToday = startDate.toDateString() === now.toDateString();
    const datePrefix = isToday ? '今日' : `${startDate.getMonth() + 1}/${startDate.getDate()}`;
    timeFormatted = `${datePrefix} ${startStr} 〜 ${endStr}`;
  }

  return { relativeTime, timeFormatted };
}

// 1. Fetch from Google Calendar REST API (OAuth)
export async function fetchUpcomingEvent(accessToken: string): Promise<CalendarEvent | null> {
  const now = new Date();
  const timeMin = now.toISOString();

  const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
  url.searchParams.set('timeMin', timeMin);
  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('orderBy', 'startTime');
  url.searchParams.set('maxResults', '5');

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('UNAUTHORIZED');
    }
    const errText = await response.text();
    throw new Error(`Google Calendar API error: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  const items = data.items || [];
  if (items.length === 0) {
    return null;
  }

  const first = items[0];
  const isAllDay = !first.start.dateTime && !!first.start.date;
  const startDate = new Date(first.start.dateTime || first.start.date);
  const endDate = new Date(first.end.dateTime || first.end.date);

  const { relativeTime, timeFormatted } = formatEventDisplay(startDate, endDate, isAllDay, now);

  return {
    id: first.id,
    summary: first.summary || '(タイトルなし)',
    start: first.start,
    end: first.end,
    location: first.location,
    htmlLink: first.htmlLink,
    isAllDay,
    timeFormatted,
    relativeTime,
  };
}

// 2. Fetch from Google Calendar iCal feed URL (Works with zero OAuth, 100% reliable on Android APK & Web!)
export async function fetchUpcomingEventFromIcal(icalUrl: string): Promise<CalendarEvent | null> {
  const now = new Date();
  let text = '';

  // Handle Google webcal:// URLs by converting to https://
  let fetchUrl = icalUrl.trim().replace(/^webcal:\/\//i, 'https://');

  try {
    const res = await fetch(fetchUrl);
    if (!res.ok) {
      throw new Error(`カレンダーURLの取得に失敗しました (ステータス: ${res.status})`);
    }
    text = await res.text();
  } catch {
    // If browser CORS prevents direct fetch, try via corsproxy
    try {
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(fetchUrl)}`;
      const res = await fetch(proxyUrl);
      if (res.ok) {
        text = await res.text();
      }
    } catch {
      throw new Error('カレンダーURLから予定を取得できませんでした。URLをご確認ください。');
    }
  }

  if (!text || !text.includes('BEGIN:VCALENDAR')) {
    throw new Error('有効なiCal形式のカレンダーではありません');
  }

  // Parse VEVENTs
  const events: { summary: string; startDate: Date; endDate: Date; location?: string; isAllDay: boolean }[] = [];
  const eventBlocks = text.split('BEGIN:VEVENT');

  for (let i = 1; i < eventBlocks.length; i++) {
    const block = eventBlocks[i].split('END:VEVENT')[0];
    let summary = '';
    let location = '';
    let startStr = '';
    let endStr = '';
    let isAllDay = false;

    const lines = block.split(/\r?\n/);
    for (let j = 0; j < lines.length; j++) {
      let line = lines[j];
      // Handle folded lines in iCal
      while (j + 1 < lines.length && (lines[j + 1].startsWith(' ') || lines[j + 1].startsWith('\t'))) {
        line += lines[j + 1].substring(1);
        j++;
      }

      if (line.startsWith('SUMMARY:')) {
        summary = line.substring(8).replace(/\\,/g, ',').replace(/\\;/g, ';').trim();
      } else if (line.startsWith('LOCATION:')) {
        location = line.substring(9).replace(/\\,/g, ',').replace(/\\;/g, ';').trim();
      } else if (line.startsWith('DTSTART')) {
        isAllDay = line.includes('VALUE=DATE');
        const idx = line.indexOf(':');
        if (idx !== -1) startStr = line.substring(idx + 1).trim();
      } else if (line.startsWith('DTEND')) {
        const idx = line.indexOf(':');
        if (idx !== -1) endStr = line.substring(idx + 1).trim();
      }
    }

    if (startStr) {
      const startDate = parseIcalDate(startStr);
      const endDate = endStr ? parseIcalDate(endStr) : new Date(startDate.getTime() + 60 * 60 * 1000);
      if (endDate.getTime() >= now.getTime() - 15 * 60 * 1000) {
        events.push({
          summary: summary || '(タイトルなし)',
          startDate,
          endDate,
          location,
          isAllDay,
        });
      }
    }
  }

  if (events.length === 0) {
    return null;
  }

  // Sort earliest start date first
  events.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  const first = events[0];
  const { relativeTime, timeFormatted } = formatEventDisplay(first.startDate, first.endDate, first.isAllDay, now);

  return {
    id: String(first.startDate.getTime()),
    summary: first.summary,
    start: { dateTime: first.startDate.toISOString() },
    end: { dateTime: first.endDate.toISOString() },
    location: first.location,
    isAllDay: first.isAllDay,
    timeFormatted,
    relativeTime,
  };
}

function parseIcalDate(str: string): Date {
  const clean = str.replace(/[^0-9TZ]/g, '');
  if (clean.length === 8) {
    const y = parseInt(clean.substring(0, 4), 10);
    const m = parseInt(clean.substring(4, 6), 10) - 1;
    const d = parseInt(clean.substring(6, 8), 10);
    return new Date(y, m, d);
  }
  const y = parseInt(clean.substring(0, 4), 10);
  const m = parseInt(clean.substring(4, 6), 10) - 1;
  const d = parseInt(clean.substring(6, 8), 10);
  const h = parseInt(clean.substring(9, 11) || '0', 10);
  const min = parseInt(clean.substring(11, 13) || '0', 10);
  const s = parseInt(clean.substring(13, 15) || '0', 10);
  if (str.endsWith('Z')) {
    return new Date(Date.UTC(y, m, d, h, min, s));
  }
  return new Date(y, m, d, h, min, s);
}
