import { useSettings } from '../../hooks/settingsContext'
import { Sheet } from '../ui/Sheet'

interface PrivacyPolicySheetProps {
  open: boolean
  onClose: () => void
}

/**
 * Shows the privacy policy inside the app.
 *
 * The policy is a real page that ships with the application bundle
 * (`privacy-policy.html`), so it renders from the device's own files — it
 * works with no network connection and needs no external URL. The very same
 * file is published separately as the public web page that Google Play links
 * to.
 */
export function PrivacyPolicySheet({ open, onClose }: PrivacyPolicySheetProps) {
  const { resolvedTheme } = useSettings()

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Privacy"
      description="Everything runs on your device."
      contentOverflow="hidden"
    >
      <iframe
        src={`/privacy-policy.html?theme=${resolvedTheme}`}
        title="Privacy policy"
        className="h-[68dvh] w-full rounded-xl border-0 bg-surface"
      />
    </Sheet>
  )
}
