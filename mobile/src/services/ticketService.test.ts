import { getTicketQrTokenOnce, getTicketQrTokenStream } from './ticketService';

class MockXMLHttpRequest {
  static latest: MockXMLHttpRequest | null = null;

  readyState = 0;
  status = 0;
  responseText = '';
  onprogress: (() => void) | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onreadystatechange: (() => void) | null = null;
  headers: Record<string, string> = {};

  open = jest.fn();
  send = jest.fn(() => {
    MockXMLHttpRequest.latest = this;
  });
  abort = jest.fn();
  setRequestHeader = jest.fn((key: string, value: string) => {
    this.headers[key] = value;
  });
}

describe('getTicketQrTokenOnce', () => {
  const OriginalXMLHttpRequest = global.XMLHttpRequest;

  beforeEach(() => {
    jest.useFakeTimers();
    MockXMLHttpRequest.latest = null;
    global.XMLHttpRequest = MockXMLHttpRequest as any;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  afterAll(() => {
    global.XMLHttpRequest = OriginalXMLHttpRequest;
  });

  it('resolves the first qr token from the stream payload', async () => {
    const tokenPromise = getTicketQrTokenOnce(
      'ticket-1',
      { lat: 41.0369, lon: 28.985 },
      'mock-token',
    );

    const xhr = MockXMLHttpRequest.latest!;
    xhr.status = 200;
    xhr.responseText = 'event: qr_token\ndata: {"token":"signed-token","expires_at":"2026-05-10T16:00:10Z","version":3}\n\n';
    xhr.onprogress?.();

    await expect(tokenPromise).resolves.toEqual({
      token: 'signed-token',
      expires_at: '2026-05-10T16:00:10Z',
      version: 3,
    });
    expect(xhr.headers['X-Client-Surface']).toBe('MOBILE');
    expect(xhr.abort).toHaveBeenCalled();
  });

  it('rejects with the backend error event message', async () => {
    const tokenPromise = getTicketQrTokenOnce(
      'ticket-1',
      { lat: 41.0369, lon: 28.985 },
      'mock-token',
    );

    const xhr = MockXMLHttpRequest.latest!;
    xhr.status = 200;
    xhr.responseText = 'event: error\ndata: {"message":"You must be near the event location to show this ticket QR."}\n\n';
    xhr.onprogress?.();

    await expect(tokenPromise).rejects.toThrow('You must be near the event location to show this ticket QR.');
  });
});

describe('getTicketQrTokenStream', () => {
  const OriginalXMLHttpRequest = global.XMLHttpRequest;

  beforeEach(() => {
    MockXMLHttpRequest.latest = null;
    global.XMLHttpRequest = MockXMLHttpRequest as any;
  });

  afterAll(() => {
    global.XMLHttpRequest = OriginalXMLHttpRequest;
  });

  it('yields qr token events from complete SSE blocks', async () => {
    const stream = getTicketQrTokenStream(
      'ticket-1',
      { lat: 41.0369, lon: 28.985 },
      'mock-token',
    );
    const nextToken = stream.next();

    const xhr = MockXMLHttpRequest.latest!;
    xhr.status = 200;
    xhr.responseText = 'event: qr_token\ndata: {"token":"signed-token","expires_at":"2026-05-10T16:00:10Z","version":3}\n\n';
    xhr.onprogress?.();

    await expect(nextToken).resolves.toEqual({
      done: false,
      value: {
        token: 'signed-token',
        expires_at: '2026-05-10T16:00:10Z',
        version: 3,
      },
    });
    await stream.return(undefined);
  });

  it('throws backend error events from the live stream', async () => {
    const stream = getTicketQrTokenStream(
      'ticket-1',
      { lat: 41.0369, lon: 28.985 },
      'mock-token',
    );
    const nextToken = stream.next();

    const xhr = MockXMLHttpRequest.latest!;
    xhr.status = 200;
    xhr.responseText = 'event: error\ndata: {"message":"Ticket has already been used."}\n\n';
    xhr.onprogress?.();

    await expect(nextToken).rejects.toThrow('Ticket has already been used.');
  });
});
