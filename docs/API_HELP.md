# Offline API help

The SDK includes two complementary offline tools:

- `mdlookup` opens the numbered, category-first browser.
- `mdapi` performs direct, searchable, and source-aware lookups.

```sh
mdlookup                       # browse from Start here
mdlookup spr                   # open one browser entry
mdapi spr                      # print complete details
mdapi sprite                   # search descriptions and keywords
mdapi --at main.lua:42:10      # nearest API call at a source position
mdapi --at main.lua:42         # all API calls on one line
mdapi --used main.lua          # concise inventory of APIs used by a file
```

The source-position form uses one-based line and column numbers, matching
Nano's position display. If the column is on an argument rather than the call
name, the nearest API call on that line is selected.

## From Nano on PicoCalc

1. Note the line and column shown by Nano.
2. Press `F6` to suspend Nano.
3. Run `mdapi --at main.lua:LINE:COLUMN` or `mdlookup`.
4. Quit the browser with `q` when applicable.
5. Run `fg` to resume the unchanged Nano session.

These tools work offline and do not build or run a ROM.

## Maintaining the generated index

API membership comes from the compiler descriptors and bundled SGDK headers;
`docs/api-notes.json` adds curated explanations and examples. After changing
either source, run:

```sh
npm run api:generate
npm run api:check
```
