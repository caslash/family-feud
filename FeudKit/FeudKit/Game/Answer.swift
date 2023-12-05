//
//  Answer.swift
//  FeudKit
//
//  Created by Cameron Slash on 11/26/23.
//

import Foundation

public class Answer: Codable, Comparable, CustomStringConvertible, Identifiable {
    public var id = UUID()
    
    public var description: String {
        return self.answer
    }
    
    public var answer: String
    
    public var value: Int
    
    public var revealed: Bool = false
    
    public init(answer: String, value: Int) {
        self.answer = answer
        self.value = value
    }
    
    public func getAnswerString() -> String { return self.answer }
    
    public func getValue() -> Int { return self.value }
    
    public func isRevealed() -> Bool { return self.revealed }
    
    public func setRevealed(revealed: Bool) { self.revealed = revealed }
    
    public static func < (lhs: Answer, rhs: Answer) -> Bool { return lhs.value < rhs.value }
    
    public static func == (lhs: Answer, rhs: Answer) -> Bool { return lhs.value == rhs.value }
    
    enum CodingKeys: CodingKey {
        case answer
        case value
    }
}
