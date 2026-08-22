import { validatePrediction } from "../lib/canvas/drawBoxes";

describe("validatePrediction", () => {
  const validPrediction = {
    x: 100,
    y: 100,
    width: 50,
    height: 50,
    confidence: 0.85,
    class: "deforestation",
  };

  const imgWidth = 800;
  const imgHeight = 600;

  it("accepts a valid prediction", () => {
    expect(validatePrediction(validPrediction, imgWidth, imgHeight).valid).toBe(
      true,
    );
  });

  it("rejects negative x coordinate", () => {
    const result = validatePrediction(
      { ...validPrediction, x: -10 },
      imgWidth,
      imgHeight,
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/left edge/);
  });

  it("rejects negative y coordinate", () => {
    const result = validatePrediction(
      { ...validPrediction, y: -5 },
      imgWidth,
      imgHeight,
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/top edge/);
  });

  it("rejects box extending beyond image width", () => {
    // x=790, width=50 → right edge = 790+25 = 815 > 800
    const result = validatePrediction(
      { ...validPrediction, x: 790, width: 50 },
      imgWidth,
      imgHeight,
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/right edge/);
  });

  it("rejects box extending beyond image height", () => {
    // y=590, height=50 → bottom edge = 590+25 = 615 > 600
    const result = validatePrediction(
      { ...validPrediction, y: 590, height: 50 },
      imgWidth,
      imgHeight,
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/bottom edge/);
  });

  it("rejects zero width", () => {
    const result = validatePrediction(
      { ...validPrediction, width: 0 },
      imgWidth,
      imgHeight,
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/width/);
  });

  it("rejects zero height", () => {
    const result = validatePrediction(
      { ...validPrediction, height: 0 },
      imgWidth,
      imgHeight,
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/height/);
  });

  it("rejects confidence above 1", () => {
    const result = validatePrediction(
      { ...validPrediction, confidence: 1.5 },
      imgWidth,
      imgHeight,
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/confidence/);
  });

  it("rejects confidence below 0", () => {
    const result = validatePrediction(
      { ...validPrediction, confidence: -0.1 },
      imgWidth,
      imgHeight,
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/confidence/);
  });

  it("accepts confidence at boundaries (0 and 1)", () => {
    expect(
      validatePrediction(
        { ...validPrediction, confidence: 0 },
        imgWidth,
        imgHeight,
      ).valid,
    ).toBe(true);
    expect(
      validatePrediction(
        { ...validPrediction, confidence: 1 },
        imgWidth,
        imgHeight,
      ).valid,
    ).toBe(true);
  });

  it("rejects empty class label", () => {
    const result = validatePrediction(
      { ...validPrediction, class: "" },
      imgWidth,
      imgHeight,
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/class label/);
  });

  it("rejects NaN confidence", () => {
    const result = validatePrediction(
      { ...validPrediction, confidence: NaN },
      imgWidth,
      imgHeight,
    );
    expect(result.valid).toBe(false);
  });

  it("rejects missing field (undefined x)", () => {
    const result = validatePrediction(
      { ...validPrediction, x: undefined as unknown as number },
      imgWidth,
      imgHeight,
    );
    expect(result.valid).toBe(false);
  });
});
