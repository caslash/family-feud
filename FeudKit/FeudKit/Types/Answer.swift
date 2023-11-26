//
//  Answer.swift
//  FeudKit
//
//  Created by Cameron Slash on 11/26/23.
//

import Foundation

public class Answer: Comparable, CustomStringConvertible {
    public var description: String
    
    private var answerString: String
    
    private var value: Int
    
    private var revealed: Bool
    
    public init(answerString: String, value: Int) {
        self.answerString = answerString
        self.value = value
        self.revealed = false
        self.description = self.answerString
    }
    
    public func getAnswerString() -> String { return self.answerString }
    
    public func getValue() -> Int { return self.value }
    
    public func isRevealed() -> Bool { return self.revealed }
    
    public func setRevealed(revealed: Bool) { self.revealed = revealed }
    
    public static func < (lhs: Answer, rhs: Answer) -> Bool { return lhs.value < rhs.value }
    
    public static func == (lhs: Answer, rhs: Answer) -> Bool { return lhs.value == rhs.value }
}
