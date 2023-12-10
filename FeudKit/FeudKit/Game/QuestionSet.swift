//
//  QuestionSet.swift
//  FeudKit
//
//  Created by Cameron Slash on 11/26/23.
//

import Foundation
import Observation

@Observable
public class QuestionSet {
    private var questions: [Question]
    
    private var selectedIndex: Int = -1
    
    public init() {
        self.questions = [Question]()
    }
    
    public func loadFromJSON(data: [String]) {
        //TODO: JSON deseralization
        let decoder = JSONDecoder()
        
        for questionSet in data {
            do {
                let question = try decoder.decode([Question].self, from: questionSet.data(using: .utf8)!)
                
                self.questions.append(contentsOf: question)
            } catch {
                fatalError("Couldn't deserialize questions: \(error.localizedDescription)")
            }
        }
    }
    
    public func getQuestion(index: Int) -> Question { return self.questions[index] }
    
    public func getQuestionIndex(_ id: UUID) -> Int { return self.questions.firstIndex { $0.id == id } ?? -1 }
    
    public func getSelectedQuestion() -> Question? { return self.selectedIndex < 0 ? nil : self.questions[selectedIndex] }
    
    public func setSelectedQuestion(index: Int) { self.selectedIndex = index }
    
    public func getQuestions() -> [Question] { return self.questions }
    
    public func size() -> Int { return self.questions.count }
    
    public func reset() { self.questions = [Question]() }
}
