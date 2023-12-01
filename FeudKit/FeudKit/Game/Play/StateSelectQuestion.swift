//
//  StateSelectQuestion.swift
//  FeudKit
//
//  Created by Cameron Slash on 11/26/23.
//

import Foundation

public class StateSelectQuestion: FFPlayState {
    public static var ACTION_SELECTQUESTION: Int = 0x0
    
    private var questions: QuestionSet
    
    private var selectedIndex: Int?
    
    internal init(questions: QuestionSet) {
        self.questions = questions
        super.init(type: FFPlayStateType.SELECT_QUESTION)
    }
    
    public override func initState(data: Any) { self.selectedIndex = -1 }
    
    public override func cleanupState() { data = selectedIndex }
    
    public override func executeAction(action: Int, data: [Any]) -> Bool {
        switch action {
        case StateSelectQuestion.ACTION_SELECTQUESTION:
            if data[1] is Int && data[2] is Int {
                return selectQuestion(index: data[1] as! Int, multiplier: data[2] as! Int)
            } else {
                //TODO: InvalidDataException
                fatalError("InvalidDataException not implemented")
            }
        default:
            //TODO: RuntimeException
            fatalError("RuntimeException not implemented")
        }
        return false
    }
    
    private func selectQuestion(index: Int, multiplier: Int) -> Bool {
        if index < questions.size() {
            if questions.getQuestion(index: index).isAnswered() {
                //TODO: Logger
                print("Question already answered!")
            } else {
                selectedIndex = index
                questions.setSelectedQuestion(index: selectedIndex!)
                questions.getSelectedQuestion()?.setMultiplier(multiplier: multiplier)
                //TODO: Logger
                print("Question [\(selectedIndex!)] selected with multiplier of \(multiplier)x.")
                return true
            }
        }
        return false
    }
    
    public override func canAdvance(nextState: String) -> Bool { return selectedIndex! > -1 }
}
