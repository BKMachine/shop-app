function isPrivateIpv4Segment(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 255;
}

function isPrivateIpv4Address(hostname: string) {
  const segments = hostname.split('.');

  if (segments.length !== 4 || !segments.every(isPrivateIpv4Segment)) {
    return false;
  }

  const [first, second] = segments.map((segment) => Number.parseInt(segment, 10));

  return (
    first === 10 ||
    first === 127 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

export function isLanHostname(hostname: string) {
  const normalizedHostname = hostname.trim().toLowerCase();

  if (!normalizedHostname) {
    return false;
  }

  if (normalizedHostname === 'localhost' || normalizedHostname === '::1') {
    return true;
  }

  if (isPrivateIpv4Address(normalizedHostname)) {
    return true;
  }

  if (normalizedHostname.endsWith('.local')) {
    return true;
  }

  return !normalizedHostname.includes('.');
}
