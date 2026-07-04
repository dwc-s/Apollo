v0.96 — Previous sessions can be searched by distance: pick a range and the history narrows to it, in whatever unit you're reading

The search-and-filter bar over Previous Sessions already narrowed the list by
notes, tags, target, bow, arrow and date. It now takes a distance too — the one
axis of a session the other filters couldn't reach.

**Distance joins the filter bar.** A new "Distance" dropdown sits alongside Bow
and Arrow, populated from every range you've actually recorded and ordered by
length rather than by text, so it reads 18, 25, 30, 50, 70 instead of sorting
"100" ahead of "25". Picking one keeps a session when any of its shots were taken
at that range, so a multi-distance round — a WA 1440, say — still surfaces when
you ask for just its 50 m leg. The choice threads through the rest of the bar
exactly like the others: it survives a tag-chip drill-in, marks the panel
"(active)", and opens the search panel on load when a distance rides in on the URL.

**The dropdown speaks your unit.** Distances live in the database as canonical
metres, and that is what the filter submits and matches on — but the visible
label follows the Metric/Imperial toggle, so the same option reads "70 m" or
"76.6 yd" without ever letting a yard reach the query. The relabelling reuses the
same 0.9144 factor the rest of the app converts with.

How it was checked: `pytest` stays green at 48. The filter was driven end-to-end
through Flask's test client against a real multi-distance history — the dropdown
came back ordered 18/25/40/50/70, "70 m" narrowed sixteen sessions to the four
that reached it, an unused range returned none, and a distance paired with a
non-matching bow returned none. The unit relabelling was exercised in a real
browser: "18.29" shows as "20 yd" in Imperial while the submitted value stays
18.29 m, so display and storage never disagree.
