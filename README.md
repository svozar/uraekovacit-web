# Ura e Kovacit Website Guide

This website is a collection of files that are published automatically from this repository. You do not need to install software or run a build process to update it.

## Before You Change Anything

1. Open the website in a browser and note what you want to change.
2. Make one small group of related changes at a time.
3. Keep a copy of any new text and images on your computer.
4. Do not rename files unless you also update every place where the old filename is used.

## Where to Find Things

- `index.html`: the English page content, room descriptions, contact details, SEO text, and image filenames.
- `js/translations.js`: Albanian, German, French, and Greek translations.
- `css/styles.css`: colors, fonts, spacing, buttons, and other visual styling.
- `img/`: website images.
- `docs/`: documents linked from the website, such as the restaurant menu.
- `CNAME`: website domain configuration. Do not change this file.

## Updating English Text

1. Open `index.html`.
2. Use your editor's search function to find the exact words you want to change.
3. Edit only the words between the HTML tags or inside the relevant attribute.
4. Leave the surrounding HTML, quotes, and tags in place.
5. Save the file.

For example, change:

```html
<h2 data-translate="rooms_title">Our Rooms</h2>
```

to:

```html
<h2 data-translate="rooms_title">Our Accommodation</h2>
```

The English words in `index.html` are the default text shown when the website opens in English.

## Updating Translations

Translations are stored in `js/translations.js`. The language sections are named:

- `sq`: Albanian
- `de`: German
- `fr`: French
- `el`: Greek

Find the matching key and change only the quoted translation. For example:

```js
rooms_title: "Dhomat Tona",
```

Do not change the key on the left (`rooms_title`). The key connects the translation to the correct text on the page.

When adding or changing English text that has a `data-translate` attribute, update the matching key in all four language sections as well. If a translation is not ready, leave the old translation in place rather than deleting the key.

## Updating an Image

1. Add the new image to the `img/` folder.
2. Use a simple filename with lowercase letters, numbers, and hyphens, such as `new-room-med.jpg`.
3. In `index.html`, find the old filename and replace it with the new filename.
4. If the image opens in a gallery, also update the `data-gallery` value on that same line.
5. Keep the `alt` text accurate so visitors using screen readers and search engines know what the image shows.

Keep images reasonably sized. JPG or WebP files are usually best for photographs. Avoid deleting an old image until you have confirmed that no page reference still uses it.

## Updating Contact Details

Search `index.html` for the old phone number or email address and update every occurrence. Check all of these areas:

- Contact section
- Reservation section
- Footer or privacy policy
- Structured data near the top of the file

Keep the `mailto:` and `tel:` links consistent with the visible text.

## Updating the Restaurant Menu

Replace `docs/ura_e_kovacit_menu_2026.pdf` with the new PDF, or upload the new PDF and update the link in `index.html` to match its exact filename. Test the link after publishing.

## Updating the Booking Widget

The booking widget is in the Reservations section of `index.html`. Do not remove this container:

```html
<div id="hb-search-widget"></div>
```

The `data-button-color` value controls the booking button color. Change it only if you intentionally want a different color.

## Publishing a Change on GitHub

If you are editing on GitHub.com:

1. Open the file you want to change.
2. Select the pencil icon to edit it.
3. Make the change.
4. Scroll down to **Commit changes**.
5. Write a short description, such as `Update room description`.
6. Select **Commit directly to the main branch** if that option is available.
7. Click **Commit changes**.

The website may take a few minutes to update. Refresh the page using a hard refresh if you still see the old version.

If GitHub offers the choice to create a branch and pull request, use that option only if someone else will review the change before it is published.

## Checking the Result

After publishing, check the live website in a private/incognito browser window and verify:

- English text is correct.
- Each language in the language menu displays the updated section.
- Images load correctly.
- The booking button works.
- The restaurant menu opens.
- Phone, email, and map links still work.
- The page looks good on both a phone and a computer.

## Undoing a Mistake

If a published change is wrong, do not delete random files. Open the changed file's history on GitHub, find the last working version, and restore the specific change. Ask the person responsible for the repository for help if you are unsure.

## Important Rules

- Do not edit or delete `CNAME`.
- Do not change `data-translate` keys unless you are intentionally changing the translation system.
- Do not put passwords, API keys, or private information in the website files.
- Do not paste formatted text from Word or Google Docs directly into HTML without checking the result.
- Make and test small changes so mistakes are easy to find and undo.
