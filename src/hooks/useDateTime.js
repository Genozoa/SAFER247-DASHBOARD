import { useEffect, useState } from 'react';

export default function useDateTime() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return now.toLocaleString();
}
