import '@/styles/profile.css';
import { useParams } from 'react-router-dom';
import { ProfileEquipmentSection, ProfilePublicHero, ProfileShowcaseSection } from './ProfilePublicSections';
import { usePublicProfileViewModel } from '../../viewmodels/profile/usePublicProfileViewModel';

export default function PublicProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const { profile, isLoading, error, retry } = usePublicProfileViewModel(userId);

  if (isLoading) {
    return (
      <div className="profile-container profile-container-wide">
        <div className="profile-public-state">
          <h1>Public Profile</h1>
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="profile-container profile-container-wide">
        <div className="profile-public-state">
          <h1>Public Profile</h1>
          <p>{error ?? 'This profile could not be loaded.'}</p>
          <button type="button" className="save-btn profile-public-retry" onClick={() => void retry()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-container profile-container-wide">
      <ProfilePublicHero profile={profile} eyebrow="Public profile" />

      <ProfileEquipmentSection
        items={profile.equipment}
        emptyMessage="This member has not listed any equipment yet."
      />

      <ProfileShowcaseSection
        items={profile.showcase_images}
        emptyMessage="No showcase images have been added yet."
      />
    </div>
  );
}
