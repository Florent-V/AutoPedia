import { InvalidRequest } from '../../../shared/domain/errors';
import { assertPushEndpoint } from './push-endpoint';

describe('assertPushEndpoint', () => {
  it('accepte les services de notification des navigateurs', () => {
    for (const url of [
      'https://fcm.googleapis.com/fcm/send/abc',
      'https://updates.push.services.mozilla.com/wpush/v2/abc',
      'https://web.push.apple.com/abc',
      'https://wns2-par02p.notify.windows.com/w/?token=abc',
    ]) {
      expect(() => assertPushEndpoint(url)).not.toThrow();
    }
  });

  it('refuse toute autre adresse (SSRF)', () => {
    for (const url of [
      'http://fcm.googleapis.com/fcm/send/abc',
      'https://localhost/x',
      'https://127.0.0.1/x',
      'https://db:5432/x',
      'https://fcm.googleapis.com.evil.com/x',
      'https://evilpush.apple.com.attacker.net/x',
      'https://fcm.googleapis.com:8443/x',
      'https://user@fcm.googleapis.com/x',
      'pas une url',
    ]) {
      expect(() => assertPushEndpoint(url)).toThrow(InvalidRequest);
    }
  });
});
