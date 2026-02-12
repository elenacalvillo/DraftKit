
# Final Layout Lock for Subscription.tsx

Three surgical edits, one file, no new dependencies.

## 1. Restore "Manage" button inside the Pro banner (line 131-132)

Add the button back inside the banner's flex container, right-aligned. Only shows for Pro users who are NOT in trial (trial users should subscribe, not manage).

```text
Banner layout:
[Status text]                    [Manage ▸]
```

## 2. Replace bottom button with Free-only "View Plans" (lines 216-223)

- If `isPro`: no bottom button at all
- If not Pro: show "View Plans" that scrolls to `#pricing`

## 3. handleManage logic stays as-is

The current three-path logic (lines 68-97) is already correct:
- `!isPro` -> scroll to pricing
- `isPro` + no `stripe_customer_id` -> founding member toast
- `isPro` + `stripe_customer_id` -> Stripe portal

No changes needed here.

---

## Technical Detail

**File: `src/pages/Subscription.tsx`**

**Edit A — Lines 131-133**: Replace empty space with Manage button inside banner:
```typescript
              </div>
              <Button variant="outline" size="sm" onClick={handleManage} disabled={loading}>
                Manage
              </Button>
            </CardContent>
```

**Edit B — Lines 216-223**: Conditional bottom button:
```typescript
        {!isPro && (
          <Button
            variant="outline"
            className="w-full mt-4"
            onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })}
          >
            View Plans
          </Button>
        )}
```

ProBadge in sidebar: already handled by `DashboardLayout` — no change needed there.
