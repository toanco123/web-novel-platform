// Xóa tài khoản ở bản giả: giống xóa auth.users trên DB (khóa ngoại cascade) — tài khoản, truyện
// và chương của người đó, cùng mọi hoạt động của họ và mọi hoạt động trên truyện của họ.
import {
  loadAllFollows,
  loadCommentReports,
  loadRatings,
  loadReports,
  loadViews,
  removeComments,
  saveCommentReports,
  saveFollows,
  saveHistory,
  saveRatings,
  saveReports,
  saveViews,
} from './activity'
import { loadUserStories, removeChapters, saveUserStories } from './userContent'
import { loadUsers, saveUsersStrict } from './users'

export function purgeUser(userId: string) {
  const stories = loadUserStories()
  const mine = stories.filter((s) => s.owner.id === userId)
  const slugs = new Set(mine.map((s) => s.slug))
  for (const story of mine) removeChapters(story.id)
  saveUserStories(stories.filter((s) => s.owner.id !== userId))

  removeComments((c) => c.user.id === userId || slugs.has(c.storySlug))
  saveReports(loadReports().filter((r) => r.reporter.id !== userId && !slugs.has(r.storySlug)))
  saveCommentReports(loadCommentReports().filter((r) => r.reporter.id !== userId))

  for (const [id, entries] of Object.entries(loadAllFollows())) {
    if (id === userId) saveFollows(id, [])
    else if (entries.some((e) => slugs.has(e.slug))) {
      saveFollows(
        id,
        entries.filter((e) => !slugs.has(e.slug)),
      )
    }
  }
  saveHistory(userId, [])

  const { [userId]: _mine, ...ratings } = loadRatings()
  saveRatings(ratings)
  const views = loadViews()
  for (const slug of slugs) delete views[slug]
  saveViews(views)

  saveUsersStrict(loadUsers().filter((u) => u.id !== userId))
}
