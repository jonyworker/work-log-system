import { computed, ref } from 'vue'

function getTodayDate() {
  const today = new Date()

  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export function useCalendar(
  initialDate = getTodayDate(),
  initialViewMode = 'week'
) {
  const selectedDate = ref(initialDate)
  const viewMode = ref(initialViewMode)

  function parseLocalDate(dateString) {
    const [year, month, day] = dateString.split('-').map(Number)
    return new Date(year, month - 1, day)
  }

  function formatDate(date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  function getWeekStart(dateString) {
    const date = parseLocalDate(dateString)
    const weekday = date.getDay()
    const diff = weekday === 0 ? -6 : 1 - weekday

    date.setDate(date.getDate() + diff)
    return date
  }

  function getIsoWeekNumber(dateString) {
    const date = parseLocalDate(dateString)

    const utcDate = new Date(
      Date.UTC(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
      )
    )

    const weekday = utcDate.getUTCDay() || 7
    utcDate.setUTCDate(utcDate.getUTCDate() + 4 - weekday)

    const yearStart = new Date(
      Date.UTC(utcDate.getUTCFullYear(), 0, 1)
    )

    return Math.ceil(
      ((utcDate - yearStart) / 86400000 + 1) / 7
    )
  }

  const weekDays = computed(() => {
    const start = getWeekStart(selectedDate.value)
    const weekdayLabels = [
      '週一',
      '週二',
      '週三',
      '週四',
      '週五',
      '週六',
      '週日',
    ]

    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start)
      date.setDate(start.getDate() + index)

      return {
        date: formatDate(date),
        weekday: weekdayLabels[index],
        weekdayIndex: date.getDay(),
        label: `${date.getMonth() + 1}/${date.getDate()}`,
      }
    })
  })

  const selectedDateLabel = computed(() => {
    const date = parseLocalDate(selectedDate.value)

    return new Intl.DateTimeFormat('zh-TW', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    }).format(date)
  })

  const weekRangeLabel = computed(() => {
    const first = weekDays.value[0]
    const last = weekDays.value[6]
    return `${first.label}－${last.label}`
  })

  const weekStartDate = computed(() => weekDays.value[0].date)
  const weekEndDate = computed(() => weekDays.value[6].date)

  const weekNumber = computed(() =>
    getIsoWeekNumber(selectedDate.value)
  )

  const monthLabel = computed(() => {
    const date = parseLocalDate(selectedDate.value)

    return new Intl.DateTimeFormat('zh-TW', {
      year: 'numeric',
      month: 'long',
    }).format(date)
  })

  const monthDays = computed(() => {
    const selected = parseLocalDate(selectedDate.value)
    const year = selected.getFullYear()
    const month = selected.getMonth()

    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)

    const start = getWeekStart(formatDate(firstDay))
    const end = new Date(lastDay)
    const endWeekday = end.getDay()
    const daysToSunday = endWeekday === 0 ? 0 : 7 - endWeekday
    end.setDate(end.getDate() + daysToSunday)

    const days = []
    const cursor = new Date(start)

    while (cursor <= end) {
      days.push({
        date: formatDate(cursor),
        dayNumber: cursor.getDate(),
        weekdayIndex: cursor.getDay(),
        inCurrentMonth: cursor.getMonth() === month,
      })

      cursor.setDate(cursor.getDate() + 1)
    }

    return days
  })

  const monthStartDate = computed(() => monthDays.value[0].date)
  const monthEndDate = computed(
    () => monthDays.value[monthDays.value.length - 1].date
  )

  const selectedDateBaseStatus = computed(() => {
    const date = parseLocalDate(selectedDate.value)
    const weekday = date.getDay()

    return weekday === 0 || weekday === 6
      ? '假日'
      : '平日'
  })

  function changeWeek(offset) {
    const date = parseLocalDate(selectedDate.value)
    date.setDate(date.getDate() + offset * 7)
    selectedDate.value = formatDate(date)
  }

  function changeMonth(offset) {
    const date = parseLocalDate(selectedDate.value)
    const originalDay = date.getDate()

    date.setDate(1)
    date.setMonth(date.getMonth() + offset)

    const lastDay = new Date(
      date.getFullYear(),
      date.getMonth() + 1,
      0
    ).getDate()

    date.setDate(Math.min(originalDay, lastDay))
    selectedDate.value = formatDate(date)
  }

  function selectDate(date, switchToDay = true) {
    selectedDate.value = date

    if (switchToDay) {
      viewMode.value = 'day'
    }
  }

  return {
    selectedDate,
    viewMode,
    weekDays,
    weekStartDate,
    weekEndDate,
    weekRangeLabel,
    weekNumber,
    monthDays,
    monthStartDate,
    monthEndDate,
    monthLabel,
    selectedDateLabel,
    selectedDateBaseStatus,
    changeWeek,
    changeMonth,
    selectDate,
  }
}
