//
//  Question.swift
//  FeudKit
//
//  Created by Cameron Slash on 11/26/23.
//

import Foundation

public class Question {
    private var questionString: String
    
    private var answers: [Answer]
    
    private var answered: Bool
    
    private var multiplier: Int = 1
    
    public init(questionString: String) {
        self.questionString = questionString
        self.answered = false
        self.answers = [Answer]()
    }
    
    public func addAnswer(answerString: String, value: Int) { self.answers.append(Answer(answerString: answerString, value: value)) }
    
    public func getAnswers() -> [Answer] { return self.answers.sorted(by: <) }
    
    public func getQuestionString() -> String { return self.questionString }
    
    public func isAnswered() -> Bool { return self.answered }
    
    public func setAnswered(answered: Bool) { self.answered = answered }
    
    public func setMultiplier(multiplier: Int) { self.multiplier = multiplier }
    
    public func getMultiplier() -> Int { return self.multiplier }
}
