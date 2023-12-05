//
//  Question.swift
//  FeudKit
//
//  Created by Cameron Slash on 11/26/23.
//

import Foundation

public class Question: Codable, Identifiable, Equatable {
    public var id = UUID()
    
    public var question: String
    
    public var answers: [Answer]
    
    public var answered: Bool = false
    
    public var multiplier: Int = 1
    
    public init(question: String) {
        self.question = question
        self.answers = [Answer]()
    }
    
    public func getAnswers() -> [Answer] { return self.answers.sorted(by: <) }
    
    public func getQuestionString() -> String { return self.question }
    
    public func isAnswered() -> Bool { return self.answered }
    
    public func setAnswered(answered: Bool) { self.answered = answered }
    
    public func setMultiplier(multiplier: Int) { self.multiplier = multiplier }
    
    public func getMultiplier() -> Int { return self.multiplier }
    
    public static func == (lhs: Question, rhs: Question) -> Bool {
        lhs.id == rhs.id
    }
    
    enum CodingKeys: CodingKey {
        case question
        case answers
    }
}
