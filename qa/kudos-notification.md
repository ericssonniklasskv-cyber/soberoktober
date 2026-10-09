# Automatic kudos notification — 2026-10-09

Production diagnosis: `aktivitet/kudos.js` updated the inbox badge but only called `openInbox` on an explicit button click. No automatic notification was implemented. The served production script matched main. A read-only aggregate query confirmed kudos and unread records exist; no participant messages, identifiers or read status were changed during diagnosis.

The fix reuses the existing recipient-scoped unread-count, inbox and read-status RPCs. Unread kudos open the existing inbox automatically once per participant/Stockholm day during a page visit. A new visit can show newly received unread kudos; database read status suppresses already read items across devices. Ordinary polling updates the badge without repeatedly reopening a dismissed inbox. Guest/entry/onboarding states block automatic display. Existing quote, elimination, weekly-report and send dialogs finish first.

Auth changes close private UI and invalidate in-flight responses. Visibility and browser back/forward restoration refresh the inbox. Pagehide pauses timers and the attribute observer. No schema, RLS, auth logic, scores or other features changed.

Verified with `qa/kudos-notification-ui.test.cjs`: production HTML/CSS and actual kudos/weekly-popup modules with recipient-scoped RPC fixtures. Automatic opening, multiple messages, read persistence, new visits, separate-device read state, popup queue, retries, logout, script injection as plain text, 320/390/768/1440px, Escape, reduced motion. No real user data is written. Existing logic tests and weekly-report UI checks also pass. The older local API test's recipient assertion now expects the automatic dialog; this test was not run against the shared local stack during this fix.

Production remains unchanged until this fix is explicitly approved for publication.
