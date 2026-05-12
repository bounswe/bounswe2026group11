import { RatingWithCount } from '@/components/RatingWithCount';
import type { EarnedBadge, ProfileEquipmentItem, PublicProfile, ShowcaseImageItem } from '@/models/profile';
import i18n from '@/i18n';

function getProfileInitial(profile: Pick<PublicProfile, 'display_name' | 'username'>): string {
  const source = profile.display_name?.trim() || profile.username;
  return source.charAt(0).toUpperCase() || '?';
}

function formatRatingSummary(profile: Pick<PublicProfile, 'host_rating_count' | 'participant_rating_count'>): string {
  const totalRatings = profile.host_rating_count + profile.participant_rating_count;
  if (totalRatings === 0) return i18n.t('public_profile.no_ratings');
  return i18n.t('public_profile.ratings_collected', { count: totalRatings });
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
          {profile.bio?.trim() || i18n.t('public_profile.no_bio')}
        </p>
      </div>

      <div className="profile-public-rating-card" aria-label={i18n.t('public_profile.rating_aria')}>
        <RatingWithCount
          score={profile.final_score}
          count={totalRatings}
          className="profile-public-rating-value"
        />
        <span className="profile-public-rating-summary">{formatRatingSummary(profile)}</span>
        <span className="profile-public-rating-breakdown">
          {i18n.t('public_profile.host_breakdown', { count: profile.host_rating_count })} · {i18n.t('public_profile.participant_breakdown', { count: profile.participant_rating_count })}
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
          <h2 className="profile-public-section-title">{i18n.t('public_profile.equipment_title')}</h2>
          <p className="profile-public-section-subtitle">{i18n.t('public_profile.equipment_subtitle')}</p>
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
                    <p className="profile-equipment-description is-empty">{i18n.t('public_profile.no_description')}</p>
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
          <h2 className="profile-public-section-title">{i18n.t('public_profile.showcase_title')}</h2>
          <p className="profile-public-section-subtitle">{i18n.t('public_profile.showcase_subtitle')}</p>
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

function earnedBadgeEmoji(slug: string, category: EarnedBadge['category']): string {
  const bySlug: Record<string, string> = {
    FIRST_STEPS: '👣',
    REGULAR: '🎟️',
    VETERAN: '🏅',
    EXPLORER: '🧭',
    HOST_DEBUT: '🎤',
    SUPER_HOST: '🌟',
    TOP_RATED: '⭐',
    FAVORITE_FINDER: '📍',
  };
  if (bySlug[slug]) return bySlug[slug];
  if (category === 'HOSTING') return '🎤';
  if (category === 'SOCIAL') return '🤝';
  return '🏅';
}

export function ProfilePublicEarnedBadgesSection({
  badges,
  loading,
  error,
  onRetry,
  viewerHasSession,
}: {
  badges: EarnedBadge[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  viewerHasSession: boolean;
}) {
  if (!viewerHasSession) return null;

  return (
    <section className="profile-public-section">
      <div className="profile-public-section-header">
        <div>
          <h2 className="profile-public-section-title">{i18n.t('public_profile.badges_title')}</h2>
          <p className="profile-public-section-subtitle">{i18n.t('public_profile.badges_subtitle')}</p>
        </div>
      </div>

      {loading ? (
        <div className="profile-public-empty">{i18n.t('public_profile.badges_loading')}</div>
      ) : error ? (
        <div className="profile-public-empty">
          <p>{error}</p>
          <button type="button" className="save-btn profile-public-retry" onClick={() => void onRetry()}>
            {i18n.t('common.retry')}
          </button>
        </div>
      ) : badges.length === 0 ? (
        <div className="profile-public-empty">{i18n.t('public_profile.badges_empty')}</div>
      ) : (
        <div className="profile-badges-row" aria-label={i18n.t('public_profile.badges_title')}>
          {badges.map((badge) => (
            <div
              key={badge.slug}
              className="profile-badge-card compact earned"
              title={i18n.t(`profile.badge_descriptions.${badge.slug}`, { defaultValue: badge.description })}
            >
              <span className="profile-badge-icon-wrap">
                {badge.icon_url ? (
                  <img src={badge.icon_url} alt="" className="profile-badge-icon-img" />
                ) : (
                  <span className="profile-badge-icon-emoji" aria-hidden>
                    {earnedBadgeEmoji(badge.slug, badge.category)}
                  </span>
                )}
              </span>
              <span className="profile-badge-name">
                {i18n.t(`profile.badge_names.${badge.slug}`, { defaultValue: badge.name })}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
