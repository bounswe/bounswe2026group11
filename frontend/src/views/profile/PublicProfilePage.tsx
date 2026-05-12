import '@/styles/profile.css';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ProfileEquipmentSection, ProfilePublicHero, ProfileShowcaseSection } from './ProfilePublicSections';
import { usePublicProfileViewModel } from '../../viewmodels/profile/usePublicProfileViewModel';

export default function PublicProfilePage() {
  const { t } = useTranslation();
  const { userId } = useParams<{ userId: string }>();
  const { profile, isLoading, error, retry } = usePublicProfileViewModel(userId);

  if (isLoading) {
    return (
      <div className="profile-container profile-container-wide">
        <div className="profile-public-state">
          <h1>{t('public_profile.title')}</h1>
          <p>{t('public_profile.loading')}</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="profile-container profile-container-wide">
        <div className="profile-public-state">
          <h1>{t('public_profile.title')}</h1>
          <p>{error ?? t('public_profile.load_failed')}</p>
          <button type="button" className="save-btn profile-public-retry" onClick={() => void retry()}>
            {t('common.retry')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-container profile-container-wide">
      <ProfilePublicHero profile={profile} eyebrow={t('public_profile.eyebrow')} />

      <ProfileEquipmentSection
        items={profile.equipment}
        emptyMessage={t('public_profile.equipment_empty_member')}
      />

      <ProfileShowcaseSection
        items={profile.showcase_images}
        emptyMessage={t('public_profile.showcase_empty_member')}
      />
    </div>
  );
}
