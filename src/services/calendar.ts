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

  // Formatting strings in Japanese
  const diffMs = startDate.getTime() - now.getTime();
  const diffMins = Math.round(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);

  let relativeTime = '';
  if (diffMs <= 0) {
    relativeTime = '現在進行中';
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
