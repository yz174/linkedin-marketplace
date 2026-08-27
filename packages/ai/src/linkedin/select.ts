import { env } from '../env';
import { ManualPasteProvider } from './manual';
import type { LinkedInProfileProvider } from './provider';
import { ScrapeCreatorsProvider } from './scrapecreators';

export function linkedInProvider(): LinkedInProfileProvider {
  return env().LINKEDIN_PROVIDER === 'manual'
    ? new ManualPasteProvider()
    : new ScrapeCreatorsProvider();
}
