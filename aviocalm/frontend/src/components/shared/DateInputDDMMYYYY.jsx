import React, { useState, useEffect } from 'react';

// Controlled date input that always displays DD/MM/YYYY regardless of browser locale.
// Fires onChange with a synthetic event where target.value is one of:
//   - A valid 'YYYY-MM-DD' string when the entered date is complete and real.
//   - 'INVALID_DATE' when the user has typed something but it is incomplete or impossible.
//   - '' when the field is fully empty.
// This keeps the parent state in a predictable ISO format and lets validateStep
// distinguish "empty" from "invalid format" for accurate error messaging.
const DateInputDDMMYYYY = ({ id, name, value, onChange, className, required, disabled }) => {
  const toDisplay = (iso) => {
    if (!iso || iso === 'INVALID_DATE') return '';
    // Strip any time/timezone suffix (e.g. "T00:00:00.000Z") from API values
    // before splitting, to avoid day-shifting on UTC-stored dates.
    const dateOnly = iso.split('T')[0];
    const parts = dateOnly.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return '';
  };

  const [display, setDisplay] = useState(() => toDisplay(value));

  // Sync the display when the parent externally changes the value (e.g. form reset
  // or initial load of existing patient data). Skip the sync when the value is
  // 'INVALID_DATE' — that marker was just emitted by this component's own onChange
  // and the display already holds whatever partial string the user is typing.
  useEffect(() => {
    if (value !== 'INVALID_DATE') {
      setDisplay(toDisplay(value));
    }
  }, [value]);

  const handleChange = (e) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 8);

    let formatted = digits;
    if (digits.length > 4) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    } else if (digits.length > 2) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    }

    setDisplay(formatted);

    if (digits.length === 8) {
      const dd = digits.slice(0, 2);
      const mm = digits.slice(2, 4);
      const yyyy = digits.slice(4, 8);
      const iso = `${yyyy}-${mm}-${dd}`;
      const d = new Date(iso);
      const isValid =
        !isNaN(d) &&
        d.getFullYear() === parseInt(yyyy, 10) &&
        d.getMonth() + 1 === parseInt(mm, 10) &&
        d.getDate() === parseInt(dd, 10);
      onChange({ target: { name, value: isValid ? iso : 'INVALID_DATE' } });
    } else if (digits.length === 0) {
      onChange({ target: { name, value: '' } });
    } else {
      onChange({ target: { name, value: 'INVALID_DATE' } });
    }
  };

  return (
    <input
      id={id}
      name={name}
      type="text"
      inputMode="numeric"
      placeholder="DD/MM/YYYY"
      maxLength={10}
      autoComplete="off"
      value={display}
      onChange={handleChange}
      className={className}
      required={required}
      disabled={disabled}
    />
  );
};

export default DateInputDDMMYYYY;
