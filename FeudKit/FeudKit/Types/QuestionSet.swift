//
//  QuestionSet.swift
//  FeudKit
//
//  Created by Cameron Slash on 11/26/23.
//

import Foundation

public class QuestionSet {
    private var questions: [Question]
    
    private var selectedIndex: Int = -1
    
    public init() {
        self.questions = [Question]()
    }
    
    public func loadFromJSON(data: JSONQuestionSet) {
        //TODO: JSON deseralization
    }
    
    public func getQuestion(index: Int) -> Question { return self.questions[index] }
    
    public func getSelectedQuestion() -> Question? { return self.selectedIndex < 0 ? nil : self.questions[selectedIndex] }
    
    public func setSelectedQuestion(index: Int) { self.selectedIndex = index }
    
    public func getQuestions() -> [Question] { return self.questions }
    
    public func size() -> Int { return self.questions.count }
    
    public func reset() { self.questions = [Question]() }
}
