import { RatingWithCount } from '@/components/RatingWithCount';
import type { ProfileEquipmentItem, PublicProfile, ShowcaseImageItem } from '@/models/profile';

function getProfileInitial(profile: Pick<PublicProfile, 'display_name' | 'username'>): string {
  const source = profile.display_name?.trim() || profile.username;
  return source.charAt(0).toUpperCase() || '?';
}

function formatRatingSummary(profile: Pick<PublicProfile, 'host_rating_count' | 'participant_rating_count'>): string {
  const totalRatings = profile.host_rating_count + profile.participant_rating_count;
  if (totalRatings === 0) return 'No ratings yet';
  return `${totalRatings} rating${totalRatings === 1 ? '' : 's'} collected`;
}

export function ProfilePublicHero({
  profile,
  eyebrow,
}: {
  profile: Pick<
    PublicProfile,
    'avatar_url' | 'bio' | 'display_name' | 'final_score' | 'host_rating_count' | 'participant_rating_count' | 'username'
  >;
  eyebrow?: string;
}) {
  const totalRatings = profile.host_rating_count + profile.participant_rating_count;

  return (
    <section className="profile-public-hero">
      <div className="profile-public-avatar" aria-hidden={!profile.avatar_url}>
        {profile.avatar_url ? (
          <img src={profile.avatar_url} alt="" />
        ) : (
          <span>{getProfileInitial(profile)}</span>
        )}
      </div>

      <div className="profile-public-copy">
        {eyebrow ? <p className="profile-public-eyebrow">{eyebrow}</p> : null}
        <h1 className="profile-public-name">{profile.display_name ?? profile.username}</h1>
        <p className="profile-public-username">@{profile.username}</p>
        <p className={`profile-public-bio ${profile.bio ? '' : 'is-empty'}`}>
          {profile.bio?.trim() || 'No bio provided yet.'}
        </p>
      </div>

      <div className="profile-public-rating-card" aria-label="Profile rating">
        <RatingWithCount
          score={profile.final_score}
          count={totalRatings}
          className="profile-public-rating-value"
        />
        <span className="profile-public-rating-summary">{formatRatingSummary(profile)}</span>
        <span className="profile-public-rating-breakdown">
          Host: {profile.host_rating_count} · Participant: {profile.participant_rating_count}
        </span>
      </div>
    </section>
  );
}

export function ProfileEquipmentSection({
  items,
  actions,
  itemActions,
  emptyMessage,
}: {
  items: ProfileEquipmentItem[];
  actions?: React.ReactNode;
  itemActions?: (item: ProfileEquipmentItem) => React.ReactNode;
  emptyMessage: string;
}) {
  return (
    <section className="profile-public-section">
      <div className="profile-public-section-header">
        <div>
          <h2 className="profile-public-section-title">Equipment</h2>
          <p className="profile-public-section-subtitle">Gear and essentials this member wants to highlight.</p>
        </div>
        {actions ? <div className="profile-public-section-actions">{actions}</div> : null}
      </div>

      {items.length > 0 ? (
        <div className="profile-equipment-grid">
          {items.map((item) => (
            <article key={item.id} className="profile-equipment-card">
              {item.image_url ? (
                <img src={item.image_url} alt="" className="profile-equipment-image" />
              ) : (
                <div className="profile-equipment-image profile-equipment-image-placeholder" aria-hidden>
                  {item.name.charAt(0).toUpperCase()}
                </div>
              )}

              <div className="profile-equipment-content">
                <div>
                  <h3 className="profile-equipment-name">{item.name}</h3>
                  {item.description ? (
                    <p className="profile-equipment-description">{item.description}</p>
                  ) : (
                    <p className="profile-equipment-description is-empty">No description provided.</p>
                  )}
                </div>
                {itemActions ? <div className="profile-equipment-actions">{itemActions(item)}</div> : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="profile-public-empty">{emptyMessage}</div>
      )}
    </section>
  );
}

export function ProfileShowcaseSection({
  items,
  actions,
  imageActions,
  emptyMessage,
}: {
  items: ShowcaseImageItem[];
  actions?: React.ReactNode;
  imageActions?: (image: ShowcaseImageItem) => React.ReactNode;
  emptyMessage: string;
}) {
  return (
    <section className="profile-public-section">
      <div className="profile-public-section-header">
        <div>
          <h2 className="profile-public-section-title">Showcase</h2>
          <p className="profile-public-section-subtitle">Moments, snapshots, and visual highlights shared on the profile.</p>
        </div>
        {actions ? <div className="profile-public-section-actions">{actions}</div> : null}
      </div>

      {items.length > 0 ? (
        <div className="profile-showcase-grid">
          {items.map((image) => (
            <figure key={image.id} className="profile-showcase-item">
              <img src={image.image_url} alt="" className="profile-showcase-image" loading="lazy" />
              {imageActions ? <figcaption className="profile-showcase-actions">{imageActions(image)}</figcaption> : null}
            </figure>
          ))}
        </div>
      ) : (
        <div className="profile-public-empty">{emptyMessage}</div>
      )}
    </section>
  );
}
