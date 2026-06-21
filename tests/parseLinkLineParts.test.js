"use strict";

const {
  LEGACY_LINK_BOX_BUTTON,
  parseLinkLineParts,
  parsePipeLinkLine
} = require("../generator/lib/parseLinkLineParts");

describe("parseLinkLineParts", () => {
  test("legacy label=url left side keeps Click Here button", () => {
    expect(parseLinkLineParts("Apply Online")).toEqual({
      displayLabel: "Apply Online",
      buttonText: LEGACY_LINK_BOX_BUTTON
    });
    expect(parseLinkLineParts("Official Website")).toEqual({
      displayLabel: "Official Website",
      buttonText: LEGACY_LINK_BOX_BUTTON
    });
  });

  test("pipe format splits label and custom button text", () => {
    expect(parseLinkLineParts("Apply Online|Apply Now")).toEqual({
      displayLabel: "Apply Online",
      buttonText: "Apply Now"
    });
    expect(parseLinkLineParts("Official Website|Visit Site")).toEqual({
      displayLabel: "Official Website",
      buttonText: "Visit Site"
    });
  });

  test("trims whitespace around pipe segments", () => {
    expect(parseLinkLineParts("  Apply Online  |  Apply Now  ")).toEqual({
      displayLabel: "Apply Online",
      buttonText: "Apply Now"
    });
  });

  test("empty left side uses fallback label and Click Here", () => {
    expect(parseLinkLineParts("")).toEqual({
      displayLabel: "Link",
      buttonText: LEGACY_LINK_BOX_BUTTON
    });
  });

  test("empty button after pipe falls back to display label", () => {
    expect(parseLinkLineParts("Apply Online|")).toEqual({
      displayLabel: "Apply Online",
      buttonText: "Apply Online"
    });
  });

  test("empty label before pipe uses fallback for display", () => {
    expect(parseLinkLineParts("|Apply Now")).toEqual({
      displayLabel: "Link",
      buttonText: "Apply Now"
    });
  });

  test("only first pipe is a separator", () => {
    expect(parseLinkLineParts("A|B|C")).toEqual({
      displayLabel: "A",
      buttonText: "B|C"
    });
  });
});

describe("parsePipeLinkLine", () => {
  test("parses dual-button Important Links syntax", () => {
    expect(
      parsePipeLinkLine("Download Syllabus|Hindi=https://hindi.com|English=https://english.com")
    ).toEqual({
      displayLabel: "Download Syllabus",
      actions: [
        { buttonText: "Hindi", href: "https://hindi.com" },
        { buttonText: "English", href: "https://english.com" }
      ]
    });
  });

  test("parses single custom button pipe syntax", () => {
    expect(parsePipeLinkLine("Apply Online|Apply Now=https://example.com")).toEqual({
      displayLabel: "Apply Online",
      actions: [{ buttonText: "Apply Now", href: "https://example.com" }]
    });
  });

  test("returns null for legacy pipe-in-label syntax", () => {
    expect(parsePipeLinkLine("A|B|C=https://example.com")).toBeNull();
  });

  test("returns null without pipes", () => {
    expect(parsePipeLinkLine("Official Website=https://example.com")).toBeNull();
  });
});
