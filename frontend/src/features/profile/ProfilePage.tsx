import { useState } from 'react'
import ProfileOverview from './ProfileOverview'
import ProfileView from './ProfileView'

/**
 * "My Profile": the overview first; Edit Profile opens the
 * full profile, which links back. Each page loads fresh when shown, so the overview
 * reflects what was just edited.
 */
export default function ProfilePage() {
  const [editing, setEditing] = useState(false)
  return editing ? <ProfileView onBack={() => setEditing(false)} /> : <ProfileOverview onEdit={() => setEditing(true)} />
}
