import { stripHtml } from './media.service';
import { commonsFileName } from './wikidata';

describe('media helpers', () => {
  it('extracts the Commons file name from a Wikidata image URL', () => {
    expect(commonsFileName('http://commons.wikimedia.org/wiki/Special:FilePath/Ferrari%20F40%20-%20front.jpg')).toBe(
      'Ferrari F40 - front.jpg',
    );
  });

  it('turns Commons author HTML into plain text', () => {
    expect(stripHtml('<a href="https://flickr.com/x">Jean&nbsp;Dupont</a> &amp; <b>Marie</b>')).toBe('Jean Dupont & Marie');
  });
});
