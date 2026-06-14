import Foundation
import Vision
import ImageIO

if CommandLine.arguments.count < 2 {
    fputs("usage: ocr_image.swift image.png\n", stderr)
    exit(2)
}

let url = URL(fileURLWithPath: CommandLine.arguments[1])
guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
      let cgImage = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
    fputs("failed to load image\n", stderr)
    exit(1)
}

let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.usesLanguageCorrection = false
request.recognitionLanguages = ["zh-Hans", "en-US"]

let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
do {
    try handler.perform([request])
} catch {
    fputs("vision failed: \(error)\n", stderr)
    exit(1)
}

let observations = request.results ?? []
let lines = observations.compactMap { obs in
    obs.topCandidates(1).first?.string
}
print(lines.joined(separator: "\n"))
