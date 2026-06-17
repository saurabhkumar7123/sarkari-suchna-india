(() => {
  const els = {
    dob: document.getElementById("dobInput"),
    dobTime: document.getElementById("dobTimeInput"),
    mode: document.getElementById("modeInput"),
    targetDate: document.getElementById("targetDateInput"),
    targetTime: document.getElementById("targetTimeInput"),
    headline: document.getElementById("headlineResult"),
    summary: document.getElementById("summaryResult"),
    stats: document.getElementById("statsResult"),
    nextBirthday: document.getElementById("nextBirthdayResult"),
    copyBtn: document.getElementById("copyResultBtn")
  };
  if (!els.dob || !els.mode) return;

  const MS_PER_MIN = 60 * 1000;
  const MS_PER_HOUR = 60 * MS_PER_MIN;
  const MS_PER_DAY = 24 * MS_PER_HOUR;

  const parseDate = (v) => {
    if (!v) return null;
    const [y, m, d] = String(v).split("-").map(Number);
    if (!y || !m || !d) return null;
    return { y, m, d };
  };

  const parseTime = (v) => {
    if (!v) return { h: 0, min: 0 };
    const [h, min] = String(v).split(":").map(Number);
    return { h: h || 0, min: min || 0 };
  };

  const daysInMonth = (y, m1) => new Date(y, m1, 0).getDate();
  const toTs = (d, t) => new Date(d.y, d.m - 1, d.d, t.h, t.min, 0, 0).getTime();
  const weekday = (d) => new Date(d.y, d.m - 1, d.d).toLocaleDateString(undefined, { weekday: "long" });

  function calculateYmdDiff(from, to) {
    let years = to.y - from.y;
    let months = to.m - from.m;
    let days = to.d - from.d;
    if (days < 0) {
      months -= 1;
      const pm = to.m === 1 ? 12 : to.m - 1;
      const py = to.m === 1 ? to.y - 1 : to.y;
      days += daysInMonth(py, pm);
    }
    if (months < 0) {
      years -= 1;
      months += 12;
    }
    return { years, months, days };
  }

  function getTargetDate(mode) {
    if (mode === "current") {
      const now = new Date();
      return {
        date: { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() },
        time: { h: now.getHours(), min: now.getMinutes() }
      };
    }
    return {
      date: parseDate(els.targetDate.value),
      time: parseTime(els.targetTime.value)
    };
  }

  function formatNumber(n) {
    return Number(n).toLocaleString("en-IN");
  }

  function update() {
    const dobDate = parseDate(els.dob.value);
    if (!dobDate) {
      els.headline.textContent = "Enter date of birth to calculate age";
      els.summary.textContent = "";
      els.stats.innerHTML = "";
      els.nextBirthday.textContent = "";
      return;
    }
    const dobTime = parseTime(els.dobTime.value);
    const mode = els.mode.value;
    const target = getTargetDate(mode);
    if (!target.date) {
      els.headline.textContent = "Select target date";
      return;
    }

    let startDate = dobDate;
    let endDate = target.date;
    let startTime = dobTime;
    let endTime = target.time;
    let reversed = false;

    if (toTs(startDate, startTime) > toTs(endDate, endTime)) {
      reversed = true;
      [startDate, endDate] = [endDate, startDate];
      [startTime, endTime] = [endTime, startTime];
    }

    const ymd = calculateYmdDiff(startDate, endDate);
    const diffMs = toTs(endDate, endTime) - toTs(startDate, startTime);
    const totalDays = Math.floor(diffMs / MS_PER_DAY);
    const totalHours = Math.floor(diffMs / MS_PER_HOUR);
    const totalMinutes = Math.floor(diffMs / MS_PER_MIN);

    const prefix = reversed ? "Difference:" : "Age:";
    els.headline.textContent = `${prefix} ${ymd.years} Years ${ymd.months} Months ${ymd.days} Days`;
    els.summary.textContent =
      `You are ${ymd.years} years, ${ymd.months} months, ${ymd.days} days old. ` +
      `You have lived ${formatNumber(totalDays)}+ days.`;

    els.stats.innerHTML = [
      { label: "Total Days", value: formatNumber(totalDays) },
      { label: "Total Hours", value: formatNumber(totalHours) },
      { label: "Total Minutes", value: formatNumber(totalMinutes) },
      { label: "Years", value: formatNumber(ymd.years) },
      { label: "Months", value: formatNumber(ymd.months) },
      { label: "Days", value: formatNumber(ymd.days) }
    ]
      .map((item) => `<div class="age-tool__card"><span>${item.label}</span><b>${item.value}</b></div>`)
      .join("");

    const now = new Date();
    let nbYear = now.getFullYear();
    let nbMonth = dobDate.m;
    let nbDay = Math.min(dobDate.d, daysInMonth(nbYear, dobDate.m));
    let nextBirthdayDate = new Date(nbYear, nbMonth - 1, nbDay);
    if (nextBirthdayDate < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
      nbYear += 1;
      nbDay = Math.min(dobDate.d, daysInMonth(nbYear, dobDate.m));
      nextBirthdayDate = new Date(nbYear, nbMonth - 1, nbDay);
    }
    const daysUntilBirthday = Math.ceil((nextBirthdayDate.getTime() - now.getTime()) / MS_PER_DAY);
    const weekdayName = weekday({ y: nbYear, m: nbMonth, d: nbDay });
    els.nextBirthday.textContent =
      `Next birthday in ${formatNumber(daysUntilBirthday)} days on ${weekdayName} ` +
      `(${nbYear}-${String(nbMonth).padStart(2, "0")}-${String(nbDay).padStart(2, "0")}).`;
  }

  [els.dob, els.dobTime, els.mode, els.targetDate, els.targetTime].forEach((el) => {
    el.addEventListener("input", update);
    el.addEventListener("change", update);
  });

  els.copyBtn.addEventListener("click", async () => {
    const text = `${els.headline.textContent}\n${els.summary.textContent}\n${els.nextBirthday.textContent}`;
    try {
      await navigator.clipboard.writeText(text.trim());
      els.copyBtn.textContent = "Copied!";
      els.copyBtn.classList.add("is-copied");
      setTimeout(() => {
        els.copyBtn.textContent = "Copy Result";
        els.copyBtn.classList.remove("is-copied");
      }, 1200);
    } catch {
      els.copyBtn.textContent = "Copy Failed";
      els.copyBtn.classList.remove("is-copied");
    }
  });

  update();
})();