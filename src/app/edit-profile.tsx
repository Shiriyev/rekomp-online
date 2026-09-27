import { router } from 'expo-router';

import { repositories } from '@/db';
import { useProfile } from '@/db/hooks';
import { AGREED_TARGETS } from '@/domain/profile';
import { ProfileForm } from '@/features/profile/ProfileForm';
import { profileToFormValues } from '@/features/profile/profileFormSchema';

export default function EditProfileScreen() {
  const { profile } = useProfile();
  if (!profile) return null;

  return (
    <ProfileForm
      defaultValues={profileToFormValues(profile, AGREED_TARGETS)}
      submitLabel="Сохранить"
      onSubmit={(next) => {
        repositories.profile.save(next);
        router.back();
      }}
    />
  );
}
