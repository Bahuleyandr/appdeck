import { Plus, Trash2 } from 'lucide-react';
import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import { useAppStore } from '../../state/appStore';
import { DEFAULT_PROFILE_COLOR, ColorRow, EmptyState } from './helpers';

export function ProfilePanel({
  profiles,
  createProfile,
  updateProfile,
  deleteProfile
}: {
  profiles: ReturnType<typeof useAppStore.getState>['profiles'];
  createProfile: (input: {
    label: string;
    color?: string | null;
    note?: string | null;
  }) => Promise<void>;
  updateProfile: (
    id: string,
    patch: Partial<ReturnType<typeof useAppStore.getState>['profiles'][number]>
  ) => Promise<void>;
  deleteProfile: (id: string) => Promise<void>;
}): JSX.Element {
  const [label, setLabel] = useState('');
  const [color, setColor] = useState(DEFAULT_PROFILE_COLOR);
  const [note, setNote] = useState('');

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <section className="panel rounded-md p-3">
        <div className="mb-3 text-sm font-semibold">Create Profile</div>
        <div className="space-y-2">
          <input
            className="field w-full"
            value={label}
            placeholder="Profile label"
            onChange={(event) => setLabel(event.target.value)}
          />
          <ColorRow value={color} onChange={setColor} />
          <input
            className="field w-full"
            value={note}
            placeholder="Note"
            onChange={(event) => setNote(event.target.value)}
          />
          <button
            className="app-button w-full"
            disabled={!label.trim()}
            onClick={() =>
              void createProfile({ label: label.trim(), color, note: note.trim() || null }).then(
                () => {
                  setLabel('');
                  setNote('');
                }
              )
            }
          >
            <Plus size={15} />
            Create
          </button>
        </div>
      </section>
      <section className="panel rounded-md p-3">
        <div className="mb-3 text-sm font-semibold">Profiles</div>
        <div className="space-y-2">
          {profiles.length === 0 && <EmptyState label="No profiles yet." />}
          {profiles.map((profile) => (
            <EditableProfile
              key={profile.id}
              profile={profile}
              updateProfile={updateProfile}
              deleteProfile={deleteProfile}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function EditableProfile({
  profile,
  updateProfile,
  deleteProfile
}: {
  profile: ReturnType<typeof useAppStore.getState>['profiles'][number];
  updateProfile: (
    id: string,
    patch: Partial<ReturnType<typeof useAppStore.getState>['profiles'][number]>
  ) => Promise<void>;
  deleteProfile: (id: string) => Promise<void>;
}): JSX.Element {
  const [label, setLabel] = useState(profile.label);
  const [color, setColor] = useState(profile.color ?? DEFAULT_PROFILE_COLOR);
  const [note, setNote] = useState(profile.note ?? '');

  useEffect(() => {
    setLabel(profile.label);
    setColor(profile.color ?? DEFAULT_PROFILE_COLOR);
    setNote(profile.note ?? '');
    // Key the reset on identity + server-side edit time, not object identity: every data-changed
    // reload creates fresh objects and used to wipe the user's in-progress edits.
  }, [profile.id, profile.updated_at]);

  return (
    <div className="rounded-md border border-line p-2">
      <div className="grid grid-cols-[1fr_120px_auto] gap-2">
        <input className="field" value={label} onChange={(event) => setLabel(event.target.value)} />
        <input className="field" value={color} onChange={(event) => setColor(event.target.value)} />
        <button
          className="icon-button"
          aria-label="Delete profile"
          title="Delete profile"
          onClick={() => void deleteProfile(profile.id)}
        >
          <Trash2 size={15} />
        </button>
      </div>
      <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
        <input
          className="field"
          value={note}
          placeholder="Note"
          onChange={(event) => setNote(event.target.value)}
        />
        <button
          className="app-button"
          disabled={!label.trim()}
          onClick={() =>
            void updateProfile(profile.id, {
              label: label.trim(),
              color,
              note: note.trim() || null
            })
          }
        >
          Save
        </button>
      </div>
    </div>
  );
}
