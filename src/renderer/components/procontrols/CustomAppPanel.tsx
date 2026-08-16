import { Plus } from 'lucide-react';
import type { JSX } from 'react';
import { useState } from 'react';
import type {
  ServiceCategory
} from '../../../shared/types';
import { useAppStore } from '../../state/appStore';
import { CATEGORIES, domainsFrom } from './helpers';

export function CustomAppPanel({
  profiles,
  createCustomService
}: {
  profiles: ReturnType<typeof useAppStore.getState>['profiles'];
  createCustomService: (input: {
    name: string;
    url: string;
    domains: string[];
    category: ServiceCategory;
    profileId?: string | null;
    defaultUserAgent?: string | null;
    unreadTitleRegex?: string | null;
    mobileMode?: boolean;
  }) => Promise<void>;
}): JSX.Element {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [domains, setDomains] = useState('');
  const [category, setCategory] = useState<ServiceCategory>('Other');
  const [profileId, setProfileId] = useState('');
  const [mobileMode, setMobileMode] = useState(false);
  const [userAgent, setUserAgent] = useState('');
  const [titleRegex, setTitleRegex] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const resolvedDomains = domainsFrom(url, domains);

  return (
    <section className="panel rounded-md p-3">
      <div className="grid gap-3 lg:grid-cols-2">
        <input
          className="field"
          value={name}
          placeholder="App name"
          onChange={(event) => setName(event.target.value)}
        />
        <input
          className="field"
          value={url}
          placeholder="https://example.com"
          onChange={(event) => setUrl(event.target.value)}
        />
        <select
          className="field"
          value={category}
          onChange={(event) => setCategory(event.target.value as ServiceCategory)}
        >
          {CATEGORIES.map((candidate) => (
            <option key={candidate} value={candidate}>
              {candidate}
            </option>
          ))}
        </select>
        <select
          className="field"
          value={profileId}
          onChange={(event) => setProfileId(event.target.value)}
        >
          <option value="">No profile</option>
          {profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.label}
            </option>
          ))}
        </select>
        <input
          className="field lg:col-span-2"
          value={domains}
          placeholder="Allowed domains, comma-separated"
          onChange={(event) => setDomains(event.target.value)}
        />
        <input
          className="field lg:col-span-2"
          value={userAgent}
          placeholder="Default user agent"
          onChange={(event) => setUserAgent(event.target.value)}
        />
        <input
          className="field lg:col-span-2"
          value={titleRegex}
          placeholder="Unread title regex"
          onChange={(event) => setTitleRegex(event.target.value)}
        />
        <label className="flex items-center gap-2 rounded-md border border-line p-2 text-sm">
          <input
            type="checkbox"
            checked={mobileMode}
            onChange={(event) => setMobileMode(event.target.checked)}
          />
          Mobile mode
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          className="app-button border-accent text-white"
          disabled={!name.trim() || !url.trim() || resolvedDomains.length === 0}
          onClick={() =>
            void createCustomService({
              name: name.trim(),
              url: url.trim(),
              domains: resolvedDomains,
              category,
              profileId: profileId || null,
              defaultUserAgent: userAgent.trim() || null,
              unreadTitleRegex: titleRegex.trim() || null,
              mobileMode
            }).then(() => {
              setName('');
              setUrl('');
              setDomains('');
              setUserAgent('');
              setTitleRegex('');
              setMessage('Added.');
            })
          }
        >
          <Plus size={15} />
          Add app
        </button>
        {resolvedDomains.length > 0 && (
          <span className="text-xs text-muted">{resolvedDomains.join(', ')}</span>
        )}
        {message && <span className="text-xs text-muted">{message}</span>}
      </div>
    </section>
  );
}
